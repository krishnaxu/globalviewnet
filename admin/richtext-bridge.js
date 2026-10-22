
(function () {
  "use strict";

  const FIELD_MAP = "__GVN_RICHTEXT_FIELDS__";

  window[FIELD_MAP] = window[FIELD_MAP] || {};

  if (!window.CMS || typeof window.CMS.registerWidget !== "function") {
    console.error("无法注册正文编辑器桥接组件：CMS 尚未加载。");
    return;
  }

  const CMS = window.CMS;
  const h = window.h;
  const createClass = window.createClass;

  if (typeof h !== "function" || typeof createClass !== "function") {
    console.error("CMS 未提供自定义编辑器所需的组件接口。");
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

      window[FIELD_MAP][name] = {
        getValue: () => this.props.value || "",
        setValue: (value) => this.props.onChange(value)
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
      if (name) delete window[FIELD_MAP][name];
    },

    render: function () {
      const widget = CMS.getWidget("richtext");

      if (!widget || !widget.control) {
        return h("div", null, "正文编辑器加载失败，请刷新页面。");
      }

      return h(widget.control, this.props);
    }
  });

  CMS.registerWidget("richtext-bridge", RichTextBridge);

  console.log("正文编辑器桥接组件已注册。");
})();
