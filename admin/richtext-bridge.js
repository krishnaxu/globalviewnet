
(function () {
  "use strict";

  const FIELD_MAP = "__GVN_RICHTEXT_FIELDS__";

  window[FIELD_MAP] = window[FIELD_MAP] || {};

  if (
    !window.CMS ||
    typeof window.CMS.registerWidget !== "function"
  ) {
    console.error(
      "[GVN Bridge] CMS 未加载，无法注册富文本桥接组件。"
    );
    return;
  }

  const CMS = window.CMS;
  const h = window.h;
  const createClass = window.createClass;

  if (typeof h !== "function" || typeof createClass !== "function") {
    console.error(
      "[GVN Bridge] 缺少 React 组件接口。"
    );
    return;
  }

  const nativeWidget = CMS.getWidget("richtext");

  if (!nativeWidget || !nativeWidget.control) {
    console.error(
      "[GVN Bridge] 找不到原生 richtext 编辑器。"
    );
    return;
  }

  if (!nativeWidget.preview) {
    console.error(
      "[GVN Bridge] 原生 richtext 预览组件不可用，停止注册以避免预览异常。"
    );
    return;
  }

  const RichTextBridge = createClass({
    displayName: "GlobalViewNetRichTextBridge",

    getFieldName: function () {
      const field = this.props.field;

      return field && typeof field.get === "function"
        ? field.get("name")
        : "";
    },

    registerField: function () {
      const name = this.getFieldName();

      if (!name) return;

      const props = this.props;

      window[FIELD_MAP][name] = {
        getValue: function () {
          return props.value == null ? "" : props.value;
        },

        setValue: function (value) {
          if (typeof props.onChange !== "function") {
            throw new Error(
              "富文本字段缺少 onChange 接口：" + name
            );
          }

          props.onChange(value == null ? "" : value);
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

      if (name && window[FIELD_MAP][name]) {
        delete window[FIELD_MAP][name];
      }
    },

    render: function () {
      return h(nativeWidget.control, this.props);
    }
  });

  CMS.registerWidget(
    "richtext-bridge",
    RichTextBridge,
    nativeWidget.preview,
    nativeWidget.schema
  );

  console.log(
    "[GVN Bridge] 富文本桥接组件已注册，原生预览组件已保留。"
  );
})();
