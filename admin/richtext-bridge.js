
(function () {
  "use strict";

  const FIELD_MAP = "__GVN_RICHTEXT_FIELDS__";

  window[FIELD_MAP] = window[FIELD_MAP] || {};

  if (
    !window.CMS ||
    typeof window.CMS.registerWidget !== "function"
  ) {
    console.error("[GVN Bridge] CMS 未加载，无法注册富文本桥接组件。");
    return;
  }

  const CMS = window.CMS;
  const h = window.h;
  const createClass = window.createClass;

  if (typeof h !== "function" || typeof createClass !== "function") {
    console.error("[GVN Bridge] 缺少 React 组件接口。");
    return;
  }

  const nativeWidget = CMS.getWidget("richtext");

  if (!nativeWidget || !nativeWidget.control || !nativeWidget.preview) {
    console.error("[GVN Bridge] 原生 richtext 编辑器或预览组件不可用。");
    return;
  }

  const RichTextBridge = createClass({
    displayName: "GlobalViewNetRichTextBridge",

    getInitialState: function () {
      return {
        editorRevision: 0
      };
    },

    getFieldName: function () {
      const field = this.props.field;

      return field && typeof field.get === "function"
        ? field.get("name")
        : "";
    },

    registerField: function () {
      const name = this.getFieldName();
      if (!name) return;

      const component = this;

      window[FIELD_MAP][name] = {
        getValue: function () {
          const value = component.props.value;
          return value == null ? "" : value;
        },

        setValue: function (value) {
          if (typeof component.props.onChange !== "function") {
            throw new Error("富文本字段缺少 onChange 接口：" + name);
          }

          const nextValue = value == null ? "" : value;

          // 先更新 CMS 字段状态。
          component.props.onChange(nextValue);

          // 仅在通过桥接接口主动回填时重建内部编辑器，
          // 使左侧原生富文本编辑器重新读取最新字段值。
          component.setState(function (state) {
            return {
              editorRevision: state.editorRevision + 1
            };
          });
        }
      };
    },

    componentDidMount: function () {
      this.registerField();
    },

    componentDidUpdate: function () {
      this.registerField();
    },

    componentWillUnmount: function () {
      const name = this.getFieldName();

      if (
        name &&
        window[FIELD_MAP][name] &&
        typeof window[FIELD_MAP][name].getValue === "function"
      ) {
        delete window[FIELD_MAP][name];
      }
    },

    render: function () {
      return h(
        nativeWidget.control,
        Object.assign({}, this.props, {
          key: "gvn-richtext-" + this.state.editorRevision
        })
      );
    }
  });

  CMS.registerWidget(
    "richtext-bridge",
    RichTextBridge,
    nativeWidget.preview,
    nativeWidget.schema
  );

  console.log("[GVN Bridge] 富文本桥接组件已注册，原生预览组件已保留。");
})();
