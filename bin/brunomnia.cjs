#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports2) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports2.ALIAS = ALIAS;
    exports2.DOC = DOC;
    exports2.MAP = MAP;
    exports2.NODE_TYPE = NODE_TYPE;
    exports2.PAIR = PAIR;
    exports2.SCALAR = SCALAR;
    exports2.SEQ = SEQ;
    exports2.hasAnchor = hasAnchor;
    exports2.isAlias = isAlias;
    exports2.isCollection = isCollection;
    exports2.isDocument = isDocument;
    exports2.isMap = isMap;
    exports2.isNode = isNode;
    exports2.isPair = isPair;
    exports2.isScalar = isScalar;
    exports2.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports2.visit = visit;
    exports2.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports2.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports2.anchorIsValid = anchorIsValid;
    exports2.anchorNames = anchorNames;
    exports2.createNodeAnchors = createNodeAnchors;
    exports2.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports2) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports2.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports2.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports2) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports2.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports2.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports2.Scalar = Scalar;
    exports2.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports2.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports2.Collection = Collection;
    exports2.collectionFromPath = collectionFromPath;
    exports2.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports2) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports2.indentComment = indentComment;
    exports2.lineComment = lineComment;
    exports2.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports2) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text2;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text2.length <= endStep)
        return text2;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text2, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text2[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text2[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text2, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text2[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text2[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text2;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text2;
      if (onFold)
        onFold();
      let res = text2.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text2.length;
        if (fold === 0)
          res = `
${indent}${text2.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text2[fold]}\\`;
          res += `
${indent}${text2.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text2, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text2[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text2[++i];
        } else {
          do {
            ch = text2[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text2[start];
        }
      }
      return end;
    }
    exports2.FOLD_BLOCK = FOLD_BLOCK;
    exports2.FOLD_FLOW = FOLD_FLOW;
    exports2.FOLD_QUOTED = FOLD_QUOTED;
    exports2.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports2.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify2(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports2.createStringifyContext = createStringifyContext;
    exports2.stringify = stringify2;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify2.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify2.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports2.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports2) {
    "use strict";
    var node_process = require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports2.debug = debug;
    exports2.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports2.addMergeToJSMap = addMergeToJSMap;
    exports2.isMergeKey = isMergeKey;
    exports2.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports2) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify2 = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify2.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports2.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports2.Pair = Pair;
    exports2.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection2, ctx, options) {
      const flow = ctx.inFlow ?? collection2.flow;
      const stringify3 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify3(collection2, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify2.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify2.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports2.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports2) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports2.YAMLMap = YAMLMap;
    exports2.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports2.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports2.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports2.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports2) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports2.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports2.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports2.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports2) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports2.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports2) {
    "use strict";
    var node_buffer = require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports2.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports2.createPairs = createPairs;
    exports2.pairs = pairs;
    exports2.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports2.YAMLOMap = YAMLOMap;
    exports2.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports2.falseTag = falseTag;
    exports2.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intBin = intBin;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports2.YAMLSet = YAMLSet;
    exports2.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports2.floatTime = floatTime;
    exports2.intTime = intTime;
    exports2.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports2.coreKnownTags = coreKnownTags;
    exports2.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports2.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify2.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify2.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify2.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports2.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports2.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports2) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports2.YAMLError = YAMLError;
    exports2.YAMLParseError = YAMLParseError;
    exports2.YAMLWarning = YAMLWarning;
    exports2.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports2) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports2.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports2) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports2.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports2) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports2.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports2.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports2) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports2.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports2) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports2.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports2) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports2.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports2.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports2.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports2.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports2.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports2.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports2) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports2.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports2.composeEmptyNode = composeEmptyNode;
    exports2.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports2) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports2.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports2.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports2) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports2.createScalarToken = createScalarToken;
    exports2.resolveAsScalar = resolveAsScalar;
    exports2.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports2) {
    "use strict";
    var stringify2 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports2.stringify = stringify2;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports2) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports2.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports2) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports2.createScalarToken = cstScalar.createScalarToken;
    exports2.resolveAsScalar = cstScalar.resolveAsScalar;
    exports2.setScalarValue = cstScalar.setScalarValue;
    exports2.stringify = cstStringify.stringify;
    exports2.visit = cstVisit.visit;
    exports2.BOM = BOM;
    exports2.DOCUMENT = DOCUMENT;
    exports2.FLOW_END = FLOW_END;
    exports2.SCALAR = SCALAR;
    exports2.isCollection = isCollection;
    exports2.isScalar = isScalar;
    exports2.prettyToken = prettyToken;
    exports2.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports2) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports2.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports2) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports2.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports2.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse2(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify2(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports2.parse = parse2;
    exports2.parseAllDocuments = parseAllDocuments;
    exports2.parseDocument = parseDocument;
    exports2.stringify = stringify2;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports2.Composer = composer.Composer;
    exports2.Document = Document.Document;
    exports2.Schema = Schema.Schema;
    exports2.YAMLError = errors.YAMLError;
    exports2.YAMLParseError = errors.YAMLParseError;
    exports2.YAMLWarning = errors.YAMLWarning;
    exports2.Alias = Alias.Alias;
    exports2.isAlias = identity.isAlias;
    exports2.isCollection = identity.isCollection;
    exports2.isDocument = identity.isDocument;
    exports2.isMap = identity.isMap;
    exports2.isNode = identity.isNode;
    exports2.isPair = identity.isPair;
    exports2.isScalar = identity.isScalar;
    exports2.isSeq = identity.isSeq;
    exports2.Pair = Pair.Pair;
    exports2.Scalar = Scalar.Scalar;
    exports2.YAMLMap = YAMLMap.YAMLMap;
    exports2.YAMLSeq = YAMLSeq.YAMLSeq;
    exports2.CST = cst;
    exports2.Lexer = lexer.Lexer;
    exports2.LineCounter = lineCounter.LineCounter;
    exports2.Parser = parser.Parser;
    exports2.parse = publicApi.parse;
    exports2.parseAllDocuments = publicApi.parseAllDocuments;
    exports2.parseDocument = publicApi.parseDocument;
    exports2.stringify = publicApi.stringify;
    exports2.visit = visit.visit;
    exports2.visitAsync = visit.visitAsync;
  }
});

// src/lib/request.ts
var templatePattern, methodPattern, normalizeHttpMethod, environmentMap, resolveTemplate, buildRequestUrl, buildHeaders;
var init_request = __esm({
  "src/lib/request.ts"() {
    templatePattern = /{{\s*([^{}]+?)\s*}}/g;
    methodPattern = /^[!#$%&'*+.^_`|~0-9A-Z-]+$/;
    normalizeHttpMethod = (value, fallback = "GET") => {
      const method = value.trim().toUpperCase();
      return method && method.length <= 32 && methodPattern.test(method) ? method : fallback;
    };
    environmentMap = (environment) => Object.fromEntries(
      (environment?.variables ?? []).filter((variable) => variable.enabled && variable.name.trim()).map((variable) => [variable.name.trim(), variable.value])
    );
    resolveTemplate = (value, variables) => value.replace(templatePattern, (match, name) => variables[name] ?? match);
    buildRequestUrl = (request, variables) => {
      let rawUrl = resolveTemplate(request.url, variables);
      (request.pathParams ?? []).filter((parameter) => parameter.enabled && parameter.name.trim()).forEach((parameter) => {
        const name = resolveTemplate(parameter.name, variables).trim();
        const value = encodeURIComponent(resolveTemplate(parameter.value, variables));
        rawUrl = rawUrl.split(`{${name}}`).join(value);
      });
      const enabledParams = request.params.filter((param) => param.enabled && param.name.trim());
      if (enabledParams.length === 0) return rawUrl;
      const url = new URL(rawUrl);
      for (const param of enabledParams) {
        url.searchParams.append(resolveTemplate(param.name, variables), resolveTemplate(param.value, variables));
      }
      return url.toString();
    };
    buildHeaders = (request, variables) => {
      const headers = request.headers.map((header) => ({
        ...header,
        name: resolveTemplate(header.name, variables),
        value: resolveTemplate(header.value, variables)
      }));
      if (!request.auth.disabled && request.auth.type === "bearer" && request.auth.token) {
        const prefix = resolveTemplate(request.auth.prefix, variables) || "Bearer";
        headers.push({ id: "auth-bearer", name: "Authorization", value: `${prefix} ${resolveTemplate(request.auth.token, variables)}`.trim(), enabled: true });
      }
      if (!request.auth.disabled && request.auth.type === "basic" && (request.auth.username || request.auth.password)) {
        const credentials = new TextEncoder().encode(`${resolveTemplate(request.auth.username, variables)}:${resolveTemplate(request.auth.password, variables)}`);
        headers.push({
          id: "auth-basic",
          name: "Authorization",
          value: `Basic ${btoa(String.fromCharCode(...credentials))}`,
          enabled: true
        });
      }
      if (!request.auth.disabled && request.auth.type === "api-key" && request.auth.apiKeyLocation === "header" && request.auth.apiKeyName) {
        headers.push({
          id: "auth-api-key",
          name: resolveTemplate(request.auth.apiKeyName, variables),
          value: resolveTemplate(request.auth.apiKeyValue, variables),
          enabled: true
        });
      }
      return headers;
    };
  }
});

// src/lib/cookies.ts
var init_cookies = __esm({
  "src/lib/cookies.ts"() {
  }
});

// src/lib/transport.ts
var normalizeRequestTimeout, resolveRequestTimeout, resolveCertificateValidation, resolveProxyTransport;
var init_transport = __esm({
  "src/lib/transport.ts"() {
    normalizeRequestTimeout = (value, fallback = 3e4) => {
      const numeric = typeof value === "number" ? value : Number.NaN;
      return Number.isFinite(numeric) ? Math.min(2147483647, Math.max(0, Math.trunc(numeric))) : fallback;
    };
    resolveRequestTimeout = (transport, globalDefault = 3e4) => normalizeRequestTimeout(transport.timeoutMode === "custom" ? transport.timeoutMs : globalDefault);
    resolveCertificateValidation = (transport, globalDefault = true) => {
      if (transport.validateCertificatesMode === "on") return true;
      if (transport.validateCertificatesMode === "off") return false;
      return globalDefault;
    };
    resolveProxyTransport = (transport, requestUrl, preferences = { enabled: false, httpProxy: "", httpsProxy: "", noProxy: "" }) => {
      if (transport.proxyMode === "custom") {
        const proxyUrl2 = transport.proxyUrl.trim();
        return proxyUrl2 ? { proxyMode: "custom", proxyUrl: proxyUrl2, proxyExclusions: transport.proxyExclusions.trim() } : { proxyMode: "disabled", proxyUrl: "", proxyExclusions: "" };
      }
      if (transport.proxyMode === "disabled") return { proxyMode: "disabled", proxyUrl: "", proxyExclusions: "" };
      if (!preferences.enabled) return { proxyMode: "system", proxyUrl: "", proxyExclusions: "" };
      let protocol = "";
      try {
        protocol = new URL(requestUrl).protocol;
      } catch {
      }
      const proxyUrl = (protocol === "http:" ? preferences.httpProxy : preferences.httpsProxy).trim();
      return proxyUrl ? { proxyMode: "custom", proxyUrl, proxyExclusions: preferences.noProxy.trim() } : { proxyMode: "disabled", proxyUrl: "", proxyExclusions: "" };
    };
  }
});

// node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
var init_tslib_es6 = __esm({
  "node_modules/@tauri-apps/api/external/tslib/tslib.es6.js"() {
  }
});

// node_modules/@tauri-apps/api/core.js
function transformCallback(callback, once = false) {
  return window.__TAURI_INTERNALS__.transformCallback(callback, once);
}
var _Channel_onmessage, _Channel_nextMessageIndex, _Channel_pendingMessages, _Channel_messageEndIndex, _Resource_rid, SERIALIZE_TO_IPC_FN, Channel;
var init_core = __esm({
  "node_modules/@tauri-apps/api/core.js"() {
    init_tslib_es6();
    SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";
    Channel = class {
      constructor(onmessage) {
        _Channel_onmessage.set(this, void 0);
        _Channel_nextMessageIndex.set(this, 0);
        _Channel_pendingMessages.set(this, []);
        _Channel_messageEndIndex.set(this, void 0);
        __classPrivateFieldSet(this, _Channel_onmessage, onmessage || (() => {
        }), "f");
        this.id = transformCallback((rawMessage) => {
          const index = rawMessage.index;
          if ("end" in rawMessage) {
            if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
              this.cleanupCallback();
            } else {
              __classPrivateFieldSet(this, _Channel_messageEndIndex, index, "f");
            }
            return;
          }
          const message = rawMessage.message;
          if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
            __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
            __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
            while (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in __classPrivateFieldGet(this, _Channel_pendingMessages, "f")) {
              const message2 = __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
              __classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message2);
              delete __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
              __classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
            }
            if (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === __classPrivateFieldGet(this, _Channel_messageEndIndex, "f")) {
              this.cleanupCallback();
            }
          } else {
            __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message;
          }
        });
      }
      cleanupCallback() {
        window.__TAURI_INTERNALS__.unregisterCallback(this.id);
      }
      set onmessage(handler) {
        __classPrivateFieldSet(this, _Channel_onmessage, handler, "f");
      }
      get onmessage() {
        return __classPrivateFieldGet(this, _Channel_onmessage, "f");
      }
      [(_Channel_onmessage = /* @__PURE__ */ new WeakMap(), _Channel_nextMessageIndex = /* @__PURE__ */ new WeakMap(), _Channel_pendingMessages = /* @__PURE__ */ new WeakMap(), _Channel_messageEndIndex = /* @__PURE__ */ new WeakMap(), SERIALIZE_TO_IPC_FN)]() {
        return `__CHANNEL__:${this.id}`;
      }
      toJSON() {
        return this[SERIALIZE_TO_IPC_FN]();
      }
    };
    _Resource_rid = /* @__PURE__ */ new WeakMap();
  }
});

// src/lib/auth.ts
var init_auth = __esm({
  "src/lib/auth.ts"() {
    init_request();
  }
});

// src/lib/templates.ts
var init_templates = __esm({
  "src/lib/templates.ts"() {
    init_cookies();
  }
});

// src/lib/timeline.ts
var init_timeline = __esm({
  "src/lib/timeline.ts"() {
  }
});

// src/lib/responseBytes.ts
var utf8Decoder, strictUtf8Decoder, utf8Encoder;
var init_responseBytes = __esm({
  "src/lib/responseBytes.ts"() {
    utf8Decoder = new TextDecoder();
    strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
    utf8Encoder = new TextEncoder();
  }
});

// src/lib/http.ts
var init_http = __esm({
  "src/lib/http.ts"() {
    init_core();
    init_auth();
    init_cookies();
    init_request();
    init_templates();
    init_timeline();
    init_responseBytes();
    init_transport();
  }
});

// cli/brunomnia.ts
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var import_node_vm = __toESM(require("node:vm"), 1);

// src/lib/openapi.ts
var import_yaml = __toESM(require_dist(), 1);

// src/lib/preferences.ts
var defaultShortcuts = {
  palette: "Mod+K",
  preferences: "Mod+,",
  send: "Mod+Enter",
  environment: "Mod+E",
  history: "Mod+Shift+H",
  "toggle-sidebar": "Mod+\\",
  "new-request": "Mod+N",
  "duplicate-request": "Mod+D",
  "delete-request": "Mod+Shift+Backspace",
  "focus-url": "Mod+L",
  "generate-code": "Mod+Shift+G"
};
var defaultPreferences = {
  theme: "system",
  density: "comfortable",
  fontSize: 11,
  interfaceFontSize: 13,
  fontInterface: "",
  fontMonospace: "",
  showPasswords: false,
  allowHtmlPreviewRemoteResources: false,
  allowHtmlPreviewScripts: false,
  disableResponsePreviewLinks: false,
  preferredHttpVersion: "default",
  maxRedirects: 10,
  followRedirects: true,
  maxTimelineDataSizeKB: 10,
  maxHistoryResponses: 20,
  filterResponsesByEnv: false,
  requestTimeoutMs: 3e4,
  validateCertificates: true,
  validateAuthCertificates: true,
  proxyEnabled: false,
  httpProxy: "",
  httpsProxy: "",
  noProxy: "",
  useBulkHeaderEditor: false,
  useBulkParametersEditor: false,
  forceVerticalLayout: false,
  editorIndentWithTabs: true,
  editorIndentSize: 2,
  editorLineWrapping: true,
  fontVariantLigatures: false,
  scriptTimeoutMs: 1e4,
  allowScriptRequests: false,
  allowScriptFileAccess: false,
  dataFolders: [],
  enableVaultInScripts: false,
  autoFetchGraphqlSchema: true,
  confirmDestructive: true,
  shortcuts: { ...defaultShortcuts }
};
var canonicalPart = (value) => {
  const lower = value.toLowerCase();
  if (lower === "mod") return "Mod";
  if (lower === "meta" || lower === "command" || lower === "cmd") return "Meta";
  if (lower === "control" || lower === "ctrl") return "Control";
  if (lower === "alt" || lower === "option") return "Alt";
  if (lower === "shift") return "Shift";
  return value;
};
var modifier = (value) => value === "Meta" || value === "Control" || value === "Alt" || value === "Shift";
var normalizeShortcut = (value) => {
  const pieces = value.split("+").map((piece) => canonicalPart(piece.trim())).filter(Boolean);
  const mods = [...new Set(pieces.filter((piece) => modifier(piece) || piece === "Mod"))];
  const key = pieces.find((piece) => !modifier(piece) && piece !== "Mod") ?? "";
  return key ? [...mods, key.length === 1 ? key.toUpperCase() : key].join("+") : "";
};

// src/data/seed.ts
var createRequest = (id, name, method, url) => ({
  id,
  name,
  protocol: "http",
  method,
  url,
  pathParams: [],
  params: [],
  headers: [{ id: `${id}-content-type`, name: "Content-Type", value: "application/json", enabled: method !== "GET" }],
  bodyMode: method === "GET" ? "none" : "json",
  renderBodyTemplates: true,
  body: "",
  formBody: [],
  multipartBody: [],
  auth: {
    type: "none",
    disabled: false,
    token: "",
    prefix: "Bearer",
    username: "",
    password: "",
    apiKeyName: "X-API-Key",
    apiKeyValue: "",
    apiKeyLocation: "header",
    oauth1SignatureMethod: "HMAC-SHA1",
    consumerKey: "",
    consumerSecret: "",
    tokenKey: "",
    tokenSecret: "",
    privateKey: "",
    version: "1.0",
    nonce: "",
    timestamp: "",
    callback: "",
    realm: "",
    verifier: "",
    includeBodyHash: false,
    oauth2GrantType: "authorization_code",
    accessTokenUrl: "",
    authorizationUrl: "",
    clientId: "",
    clientSecret: "",
    audience: "",
    scope: "",
    resource: "",
    origin: "",
    redirectUrl: "http://localhost/",
    credentialsInBody: false,
    state: "",
    code: "",
    accessToken: "",
    identityToken: "",
    refreshToken: "",
    expiresAt: 0,
    tokenPrefix: "Bearer",
    usePkce: false,
    pkceMethod: "S256",
    codeVerifier: "",
    responseType: "code",
    ntlmDomain: "",
    ntlmWorkstation: "BRUNOMNIA",
    awsAccessKeyId: "",
    awsSecretAccessKey: "",
    awsSessionToken: "",
    awsRegion: "us-east-1",
    awsService: "execute-api",
    hawkId: "",
    hawkKey: "",
    hawkExt: "",
    hawkAlgorithm: "sha256",
    hawkValidatePayload: true,
    asapIssuer: "",
    asapSubject: "",
    asapAudience: "",
    asapAdditionalClaims: "{}",
    asapPrivateKey: "",
    asapKeyId: "",
    netrc: ""
  },
  graphql: {
    query: "query GetViewer {\n  viewer {\n    id\n    name\n  }\n}",
    variables: "{}",
    operationName: "GetViewer",
    schemaEndpoint: "",
    schemaFetchedAt: ""
  },
  grpc: {
    service: "",
    method: "",
    descriptorSource: "reflection",
    protoText: `syntax = "proto3";
package brunomnia.orders.v1;

service OrdersService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchOrdersRequest) returns (stream Order);
}

message GetOrderRequest { string id = 1; }
message WatchOrdersRequest { string status = 1; }
message Order { string id = 1; string status = 2; double total = 3; }`,
    descriptorSetBase64: "",
    input: "{}",
    metadata: []
  },
  transport: {
    followRedirects: true,
    followRedirectsMode: "global",
    timeoutMode: "global",
    timeoutMs: 6e4,
    validateCertificatesMode: "global",
    validateCertificates: true,
    proxyMode: "global",
    proxyUrl: "",
    proxyExclusions: "",
    clientCertificatePem: "",
    clientKeyPem: "",
    clientCertificateDomains: "",
    sendCookies: true,
    storeCookies: true
  },
  sse: {
    autoReconnect: true,
    reconnectDelayMs: 1e3,
    maxReconnects: 0,
    respectServerRetry: true,
    sendLastEventId: true
  },
  socketIo: {
    path: "/socket.io",
    eventName: "message",
    args: [{ id: `${id}-socketio-arg`, value: "{}", mode: "json" }],
    ack: false,
    eventListeners: []
  },
  preRequestScript: "// Runs before the request\n",
  tests: `insomnia.test('Status is successful', () => {
  expect(insomnia.response.status).toBeLessThan(400);
});
`
});
var orders = createRequest("create-order", "Create Order", "POST", "https://api.acme.dev/v1/orders");
orders.body = JSON.stringify(
  {
    customerId: "cus_12345",
    items: [
      { productId: "prod_98765", quantity: 2, unitPrice: 49.99 },
      { productId: "prod_56789", quantity: 1, unitPrice: 19.99 }
    ],
    shippingAddress: { line1: "123 Market St", line2: "Apt 4B" }
  },
  null,
  2
);
var collection = (id, name, requests) => ({
  id,
  name,
  expanded: true,
  requests,
  folders: [],
  environment: [],
  documentation: ""
});
var seedWorkspace = {
  format: "brunomnia",
  version: 28,
  name: "Local Workspace",
  activeRequestId: orders.id,
  activeEnvironmentId: "development",
  collections: [
    collection("orders", "Orders", [
      createRequest("list-orders", "List Orders", "GET", "https://api.acme.dev/v1/orders"),
      orders,
      createRequest("get-order", "Get Order", "GET", "https://api.acme.dev/v1/orders/{{ orderId }}"),
      createRequest("update-order", "Update Order", "PATCH", "https://api.acme.dev/v1/orders/{{ orderId }}"),
      createRequest("delete-order", "Delete Order", "DELETE", "https://api.acme.dev/v1/orders/{{ orderId }}")
    ]),
    collection("customers", "Customers", [
      createRequest("list-customers", "List Customers", "GET", "https://api.acme.dev/v1/customers"),
      createRequest("create-customer", "Create Customer", "POST", "https://api.acme.dev/v1/customers")
    ]),
    collection("products", "Products", [
      createRequest("list-products", "List Products", "GET", "https://api.acme.dev/v1/products"),
      createRequest("get-product", "Get Product", "GET", "https://api.acme.dev/v1/products/{{ productId }}")
    ]),
    collection("health", "Health", [
      createRequest("health-check", "Health Check", "GET", "https://api.acme.dev/health")
    ]),
    collection("protocols", "Protocol Lab", [
      {
        ...createRequest("graphql-viewer", "GraphQL Viewer", "POST", "https://api.acme.dev/graphql"),
        protocol: "graphql"
      },
      {
        ...createRequest("live-orders", "Live Orders", "GET", "wss://ws.acme.dev/orders"),
        protocol: "websocket"
      },
      {
        ...createRequest("socketio-orders", "Socket.IO Orders", "GET", "https://socket.acme.dev/orders"),
        protocol: "socketio",
        socketIo: {
          path: "/socket.io",
          eventName: "message",
          args: [{ id: "socketio-orders-arg", value: '{\n  "status": "pending"\n}', mode: "json" }],
          ack: true,
          eventListeners: [{ id: "socketio-orders-listener", eventName: "order.updated", description: "Order lifecycle updates", enabled: true }]
        }
      },
      {
        ...createRequest("order-events", "Order Events", "GET", "https://events.acme.dev/orders"),
        protocol: "sse"
      },
      {
        ...createRequest("grpc-orders", "Orders gRPC", "POST", "http://127.0.0.1:50051"),
        protocol: "grpc"
      }
    ])
  ],
  environments: [
    {
      id: "base-environment",
      name: "Base Environment",
      variables: [
        { id: "base-order-id", name: "orderId", value: "ord_abc123", enabled: true },
        { id: "base-product-id", name: "productId", value: "prod_98765", enabled: true }
      ],
      parentId: "",
      private: false,
      color: "#7e8a91"
    },
    {
      id: "development",
      name: "Development",
      variables: [{ id: "dev-base-url", name: "baseUrl", value: "https://api.acme.dev", enabled: true }],
      parentId: "base-environment",
      private: false,
      color: "#66c68d"
    },
    {
      id: "production",
      name: "Production",
      variables: [{ id: "prod-base-url", name: "baseUrl", value: "https://api.acme.com", enabled: true }],
      parentId: "base-environment",
      private: false,
      color: "#ff9d4a"
    }
  ],
  history: [],
  apiDesigns: [
    {
      id: "orders-api-design",
      name: "Orders API",
      ruleset: "",
      contents: `openapi: 3.1.0
info:
  title: Orders API
  version: 1.0.0
  description: Local-first order operations
servers:
  - url: https://api.acme.dev
paths:
  /v1/orders:
    get:
      operationId: listOrders
      summary: List orders
      responses:
        '200':
          description: Orders returned
    post:
      operationId: createOrder
      summary: Create an order
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        '201':
          description: Order created
  /v1/orders/{orderId}:
    get:
      operationId: getOrder
      summary: Get an order
      parameters:
        - in: path
          name: orderId
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Order returned
`
    }
  ],
  mockServers: [
    {
      id: "orders-mock",
      name: "Orders local mock",
      host: "127.0.0.1",
      port: 4010,
      routes: [
        {
          id: "mock-list-orders",
          name: "List orders",
          enabled: true,
          method: "GET",
          path: "/v1/orders",
          status: 200,
          headers: [{ id: "mock-content-type", name: "Content-Type", value: "application/json", enabled: true }],
          body: JSON.stringify({ data: [{ id: "ord_mock_1", status: "PROCESSING" }], generatedAt: "{{$timestamp}}" }, null, 2),
          delayMs: 0
        }
      ]
    }
  ],
  runnerReports: [],
  imports: [],
  cookies: [],
  responses: [],
  streamSessions: [],
  responseFilters: {},
  project: { mode: "local", path: "", remoteUrl: "", remoteName: "origin", authorName: "", authorEmail: "", autoSave: true },
  plugins: [],
  pluginData: {},
  activePluginTheme: "",
  collaboration: { mode: "off", path: "", actor: "Local owner", revision: 0 },
  governance: {
    currentMemberId: "local-owner",
    members: [{ id: "local-owner", name: "Local owner", email: "", role: "owner", active: true }],
    policy: { allowedStorage: ["local", "folder", "git", "encrypted-file"], requireEncryptedSync: true, requireVaultForSecrets: true, externalVaultAllowlist: [], auditRetention: 500 },
    audit: []
  },
  mcpClients: [],
  ai: { enabled: false, provider: "openai-compatible", baseUrl: "http://127.0.0.1:11434/v1", model: "", apiKey: "", mockGeneration: false, commitSuggestions: false },
  konnect: { enabled: false, baseUrl: "https://us.api.konghq.com", token: "", controlPlaneId: "", controlPlanes: [] },
  preferences: structuredClone(defaultPreferences)
};
var cloneSeedWorkspace = () => structuredClone(seedWorkspace);
var createBlankRequest = (id) => createRequest(id, "Untitled Request", "GET", "https://");

// src/lib/openapi.ts
var operationMethods = /* @__PURE__ */ new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
var record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
var pathLabel = (...parts) => parts.join(".").replace(/\.\[/g, "[");
var childNodes = (node) => {
  if (Array.isArray(node.value)) return node.value.map((value, index) => ({ value, path: `${node.path}[${index}]` }));
  const object = record(node.value);
  return object ? Object.entries(object).map(([key, value]) => ({ value, path: `${node.path}.${key}` })) : [];
};
var selectRuleNodes = (document, expression) => {
  const recursive = expression.match(/^\$\.\.([\w-]+)$/);
  if (recursive) {
    const output = [];
    const visit = (node) => {
      childNodes(node).forEach((child) => {
        if (child.path.endsWith(`.${recursive[1]}`)) output.push(child);
        visit(child);
      });
    };
    visit({ value: document, path: "$" });
    return output;
  }
  const normalized = expression.trim().replace(/^\$\.?/, "").replace(/\[['"]([^'"]+)['"]\]/g, ".$1").replace(/\[\*\]/g, ".*").replace(/^\./, "");
  if (!normalized) return [{ value: document, path: "$" }];
  return normalized.split(".").filter(Boolean).reduce((nodes, segment) => nodes.flatMap((node) => {
    if (segment === "*") return childNodes(node);
    if (Array.isArray(node.value) && /^\d+$/.test(segment)) {
      const index = Number(segment);
      return index < node.value.length ? [{ value: node.value[index], path: `${node.path}[${index}]` }] : [];
    }
    const object = record(node.value);
    return object && segment in object ? [{ value: object[segment], path: `${node.path}.${segment}` }] : [];
  }), [{ value: document, path: "$" }]);
};
var fieldNode = (node, field) => {
  if (!field) return node;
  let current = node;
  for (const segment of field.split(".").filter(Boolean)) {
    const object = record(current.value);
    current = { value: object?.[segment], path: `${current.path}.${segment}` };
  }
  return current;
};
var ruleFails = (value, functionName, options) => {
  if (functionName === "truthy") return !value;
  if (functionName === "falsy") return Boolean(value);
  if (functionName === "defined") return value === void 0 || value === null;
  if (functionName === "enumeration") return !Array.isArray(options.values) || !options.values.some((candidate) => candidate === value);
  if (functionName === "length") {
    const length = typeof value === "string" || Array.isArray(value) ? value.length : record(value) ? Object.keys(record(value) ?? {}).length : 0;
    return typeof options.min === "number" && length < options.min || typeof options.max === "number" && length > options.max;
  }
  if (functionName === "pattern") {
    if (typeof value !== "string") return true;
    try {
      if (typeof options.match === "string" && !new RegExp(options.match).test(value)) return true;
      if (typeof options.notMatch === "string" && new RegExp(options.notMatch).test(value)) return true;
      return false;
    } catch {
      return true;
    }
  }
  if (functionName === "casing") {
    if (typeof value !== "string") return true;
    const patterns = { camel: /^[a-z][A-Za-z0-9]*$/, pascal: /^[A-Z][A-Za-z0-9]*$/, kebab: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, snake: /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/ };
    return !(patterns[asString(options.type)] ?? patterns.camel).test(value);
  }
  return false;
};
var asString = (value, fallback = "") => typeof value === "string" ? value : fallback;
var customRulesetIssues = (document, source) => {
  if (!source.trim()) return [];
  let ruleset;
  try {
    ruleset = record((0, import_yaml.parse)(source)) ?? {};
  } catch (error) {
    return [{ severity: "error", path: "$ruleset", message: error instanceof Error ? error.message : "The custom ruleset is invalid." }];
  }
  const rules = record(ruleset.rules) ?? ruleset;
  const issues = [];
  if (ruleset.extends) issues.push({ severity: "warning", path: "$ruleset.extends", message: "Remote, package, and inherited Spectral rulesets are not executed by the local safe rules engine." });
  if (ruleset.functions || ruleset.functionsDir) issues.push({ severity: "warning", path: "$ruleset.functions", message: "Custom JavaScript ruleset functions are not executed by the local safe rules engine." });
  for (const [ruleName, rawRule] of Object.entries(rules)) {
    if (rawRule === false || rawRule === "off") continue;
    const rule = record(rawRule);
    if (!rule) continue;
    const severityValue = asString(rule.severity, rule.severity === 0 ? "error" : "warn").toLowerCase();
    if (severityValue === "off") continue;
    const severity = severityValue === "error" || severityValue === "0" ? "error" : "warning";
    const given = Array.isArray(rule.given) ? rule.given.map((value) => asString(value)).filter(Boolean) : [asString(rule.given, "$")];
    const conditions = Array.isArray(rule.then) ? rule.then : [rule.then];
    given.flatMap((expression) => selectRuleNodes(document, expression)).forEach((selected) => conditions.forEach((rawCondition) => {
      const condition = record(rawCondition);
      if (!condition) return;
      const target = fieldNode(selected, asString(condition.field));
      const functionName = asString(condition.function);
      if (!["truthy", "falsy", "defined", "enumeration", "length", "pattern", "casing"].includes(functionName)) {
        issues.push({ severity: "warning", path: `$ruleset.rules.${ruleName}`, message: `Ruleset function '${functionName || "(empty)"}' is not supported by the local safe rules engine.` });
        return;
      }
      if (!ruleFails(target.value, functionName, record(condition.functionOptions) ?? {})) return;
      const message = asString(rule.message) || asString(rule.description) || `Custom rule '${ruleName}' failed ${functionName}.`;
      issues.push({ severity, path: target.path.replace(/^\$\.?/, "") || "$", message: message.replace(/{{\s*property\s*}}/g, target.path.split(".").at(-1) ?? "").replace(/{{\s*path\s*}}/g, target.path) });
    }));
  }
  return issues;
};
var analyzeOpenApi = (contents, ruleset = "") => {
  const issues = [];
  let parsed;
  try {
    parsed = (0, import_yaml.parse)(contents);
  } catch (error) {
    return {
      issues: [{ severity: "error", path: "$", message: error instanceof Error ? error.message : "Invalid YAML or JSON." }],
      operations: [],
      title: "Invalid document",
      version: ""
    };
  }
  const document = record(parsed);
  if (!document) {
    return { issues: [{ severity: "error", path: "$", message: "The document root must be an object." }], operations: [], title: "Invalid document", version: "" };
  }
  const openapi = typeof document.openapi === "string" ? document.openapi : "";
  if (!openapi.startsWith("3.")) issues.push({ severity: "error", path: "openapi", message: "Brunomnia expects an OpenAPI 3.x document." });
  const info = record(document.info);
  const title = typeof info?.title === "string" ? info.title : "Untitled API";
  const version = typeof info?.version === "string" ? info.version : "";
  if (!info?.title) issues.push({ severity: "error", path: "info.title", message: "Add an API title." });
  if (!info?.version) issues.push({ severity: "error", path: "info.version", message: "Add an API version." });
  const paths = record(document.paths);
  if (!paths || Object.keys(paths).length === 0) issues.push({ severity: "error", path: "paths", message: "Define at least one API path." });
  const operations = [];
  const operationIds = /* @__PURE__ */ new Set();
  for (const [path, rawPathItem] of Object.entries(paths ?? {})) {
    if (!path.startsWith("/")) issues.push({ severity: "error", path: pathLabel("paths", path), message: "Path keys must begin with /." });
    const pathItem = record(rawPathItem);
    if (!pathItem) continue;
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!operationMethods.has(method)) continue;
      const operation = record(rawOperation);
      if (!operation) continue;
      const operationPath = pathLabel("paths", path, method);
      const operationId = typeof operation.operationId === "string" && operation.operationId ? operation.operationId : `${method}-${path.replace(/[^a-z0-9]+/gi, "-")}`;
      if (!operation.operationId) issues.push({ severity: "warning", path: `${operationPath}.operationId`, message: "Add an operationId for stable generated request names." });
      if (operationIds.has(operationId)) issues.push({ severity: "error", path: `${operationPath}.operationId`, message: `Duplicate operationId: ${operationId}.` });
      operationIds.add(operationId);
      const responses = record(operation.responses);
      if (!responses || Object.keys(responses).length === 0) issues.push({ severity: "error", path: `${operationPath}.responses`, message: "Every operation needs at least one response." });
      const rawParameters = [
        ...Array.isArray(pathItem.parameters) ? pathItem.parameters : [],
        ...Array.isArray(operation.parameters) ? operation.parameters : []
      ];
      const parameters = rawParameters.flatMap((rawParameter) => {
        const parameter = record(rawParameter);
        if (!parameter || typeof parameter.name !== "string" || typeof parameter.in !== "string") return [];
        const schema = record(parameter.schema);
        const example = parameter.example ?? schema?.example ?? schema?.default;
        const value = example === void 0 ? "" : typeof example === "string" ? example : JSON.stringify(example);
        return [{ name: parameter.name, location: parameter.in, required: Boolean(parameter.required), description: asString(parameter.description), value }];
      });
      for (const match of path.matchAll(/{([^}]+)}/g)) {
        if (!parameters.some((parameter) => parameter.location === "path" && parameter.name === match[1] && parameter.required)) {
          issues.push({ severity: "error", path: `${operationPath}.parameters`, message: `Path parameter {${match[1]}} must be declared and required.` });
        }
      }
      operations.push({
        id: operationId,
        method: method.toUpperCase(),
        path,
        summary: typeof operation.summary === "string" ? operation.summary : operationId,
        description: typeof operation.description === "string" ? operation.description : "",
        parameters
      });
    }
  }
  issues.push(...customRulesetIssues(document, ruleset));
  return { document, issues, operations, title, version };
};
var schemaExample = (schema) => {
  if (!schema) return {};
  if ("example" in schema) return schema.example;
  if ("default" in schema) return schema.default;
  if (schema.type === "array") return [schemaExample(record(schema.items))];
  if (schema.type === "object" || schema.properties) {
    return Object.fromEntries(Object.entries(record(schema.properties) ?? {}).map(([name, property]) => [name, schemaExample(record(property))]));
  }
  if (schema.type === "integer" || schema.type === "number") return 0;
  if (schema.type === "boolean") return false;
  return "";
};
var generateCollectionFromOpenApi = (design) => {
  const analysis = analyzeOpenApi(design.contents, design.ruleset);
  if (!analysis.document || analysis.issues.some((issue) => issue.severity === "error")) {
    throw new Error("Resolve OpenAPI errors before generating a collection.");
  }
  const server = Array.isArray(analysis.document.servers) ? record(analysis.document.servers[0])?.url : void 0;
  const baseUrl = typeof server === "string" ? server.replace(/\/$/, "") : "{{ baseUrl }}";
  const paths = record(analysis.document.paths) ?? {};
  const requests = analysis.operations.map((operation, index) => {
    const request = createBlankRequest(`openapi-${design.id}-${index}`);
    const operationDocument = record(record(paths[operation.path])?.[operation.method.toLowerCase()]);
    const content = record(record(operationDocument?.requestBody)?.content);
    const jsonSchema = record(record(content?.["application/json"])?.schema);
    request.name = operation.summary;
    request.method = operation.method;
    request.url = `${baseUrl}${operation.path}`;
    request.pathParams = operation.parameters.filter((parameter) => parameter.location === "path").map((parameter) => ({
      id: `${request.id}-path-${parameter.name}`,
      name: parameter.name,
      value: parameter.value,
      enabled: true,
      description: parameter.description
    }));
    request.params = operation.parameters.filter((parameter) => parameter.location === "query").map((parameter) => ({
      id: `${request.id}-query-${parameter.name}`,
      name: parameter.name,
      value: parameter.value,
      enabled: parameter.required,
      description: parameter.description
    }));
    request.headers = operation.parameters.filter((parameter) => parameter.location === "header").map((parameter) => ({
      id: `${request.id}-header-${parameter.name}`,
      name: parameter.name,
      value: parameter.value,
      enabled: parameter.required,
      description: parameter.description
    }));
    if (jsonSchema || content?.["application/json"]) {
      request.bodyMode = "json";
      request.body = JSON.stringify(schemaExample(jsonSchema), null, 2);
      request.headers.push({ id: `${request.id}-content-type`, name: "Content-Type", value: "application/json", enabled: true });
    } else {
      request.bodyMode = "none";
    }
    return request;
  });
  return { id: `collection-${design.id}`, name: analysis.title, expanded: true, requests };
};

// cli/brunomnia.ts
init_request();

// src/lib/runner.ts
init_request();

// src/lib/resources.ts
var variableScope = (layers) => {
  const values = {};
  const disabled = /* @__PURE__ */ new Set();
  layers.forEach((rows) => rows.forEach((row) => {
    const name = row.name.trim();
    if (!name) return;
    if (row.enabled) {
      values[name] = row.value;
      disabled.delete(name);
    } else {
      delete values[name];
      disabled.add(name);
    }
  }));
  return { values, disabled: [...disabled] };
};
var scriptEnvironmentScopes = (environments, activeId) => {
  const selected = environments.find((environment) => environment.id === activeId) ?? environments[0];
  if (!selected) return void 0;
  const ancestors = environmentAncestors(environments, selected.id);
  const base = ancestors[0] ?? selected;
  const globalsAreBase = base.id === selected.id;
  return {
    baseId: base.id,
    selectedId: selected.id,
    baseGlobals: variableScope([base.variables]),
    globals: globalsAreBase ? variableScope([base.variables]) : variableScope([...ancestors.slice(1).map((environment) => environment.variables), selected.variables]),
    globalsAreBase
  };
};
var collectionEnvironmentScopes = (collection2) => {
  const selected = (collection2.subEnvironments ?? []).find((environment) => environment.id === collection2.activeSubEnvironmentId);
  return {
    baseEnvironment: variableScope([collection2.environment ?? []]),
    environment: selected ? variableScope([selected.variables]) : variableScope([collection2.environment ?? []]),
    environmentIsBase: !selected,
    selectedId: selected?.id
  };
};
var rowMap = (rows, caseInsensitive) => {
  const output = /* @__PURE__ */ new Map();
  rows.forEach((row) => {
    const name = row.name.trim();
    if (!name) return;
    output.set(caseInsensitive ? name.toLowerCase() : name, row);
  });
  return output;
};
var mergeRows = (layers, caseInsensitive = false) => {
  const merged = /* @__PURE__ */ new Map();
  layers.forEach((rows) => rowMap(rows, caseInsensitive).forEach((row, name) => merged.set(name, row)));
  return [...merged.values()];
};
var resolveEnvironment = (environments, activeId) => {
  const selected = environments.find((environment) => environment.id === activeId) ?? environments[0];
  if (!selected) return void 0;
  const byId = new Map(environments.map((environment) => [environment.id, environment]));
  const chain = [];
  const visited = /* @__PURE__ */ new Set();
  let current = selected;
  while (current && !visited.has(current.id) && chain.length < 20) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : void 0;
  }
  return { ...selected, variables: mergeRows(chain.map((environment) => environment.variables)) };
};
var environmentAncestors = (environments, environmentId) => {
  const byId = new Map(environments.map((environment) => [environment.id, environment]));
  const output = [];
  const visited = /* @__PURE__ */ new Set();
  let current = byId.get(environmentId);
  while (current?.parentId && !visited.has(current.id) && output.length < 20) {
    visited.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    output.unshift(parent);
    current = parent;
  }
  return output;
};
var folderAncestors = (collection2, folderId) => {
  if (!folderId) return [];
  const byId = new Map((collection2.folders ?? []).map((folder) => [folder.id, folder]));
  const chain = [];
  const visited = /* @__PURE__ */ new Set();
  let current = byId.get(folderId);
  while (current && !visited.has(current.id) && chain.length < 20) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : void 0;
  }
  return chain;
};
var joinedScripts = (scripts) => scripts.map((script) => script.trim()).filter(Boolean).join("\n\n");
var applyCollectionConfiguration = (collection2, request, environment) => {
  const folders = folderAncestors(collection2, request.folderId);
  const nearestAuth = [...folders].reverse().find((folder) => folder.auth)?.auth;
  const selectedCollectionEnvironment = (collection2.subEnvironments ?? []).find((candidate) => candidate.id === collection2.activeSubEnvironmentId);
  return {
    folders,
    environment: { ...environment, variables: mergeRows([environment.variables, collection2.environment ?? [], selectedCollectionEnvironment?.variables ?? [], ...folders.map((folder) => folder.environment)]) },
    request: {
      ...request,
      headers: mergeRows([...folders.map((folder) => folder.headers), request.headers], true),
      auth: request.inheritFolderAuth && nearestAuth ? structuredClone(nearestAuth) : request.auth,
      preRequestScript: joinedScripts([...folders.map((folder) => folder.preRequestScript), request.preRequestScript]),
      tests: joinedScripts([request.tests, ...[...folders].reverse().map((folder) => folder.tests)])
    }
  };
};

// src/lib/runner.ts
var runId = () => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
var wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var boundedInteger = (value, minimum, maximum) => {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
};
var validateTestNamePattern = (value) => {
  if (value === void 0) return void 0;
  if (value.length > 1e3) throw new Error("Test name pattern exceeds 1,000 characters.");
  try {
    new RegExp(value);
  } catch (error) {
    throw new Error(`Invalid test name pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
  return value;
};
var RUNNER_RESPONSE_PER_RESULT_BYTES = 32e3;
var RUNNER_RESPONSE_REPORT_BYTES = 1e6;
var RUNNER_REQUEST_PER_RESULT_BYTES = 16e3;
var RUNNER_REQUEST_REPORT_BYTES = 5e5;
var RUNNER_RESPONSE_BODY_BYTES = 16e3;
var RUNNER_RESPONSE_HEADERS = 64;
var takeUtf8 = (value, maximumBytes) => {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= maximumBytes) return { value, bytes: encoded.byteLength, truncated: false };
  let end = Math.max(0, maximumBytes);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  while (end > 0) {
    try {
      return { value: decoder.decode(encoded.slice(0, end)), bytes: end, truncated: true };
    } catch {
      end -= 1;
    }
  }
  return { value: "", bytes: 0, truncated: encoded.byteLength > 0 };
};
var captureRunnerResponse = (response, budget) => {
  let remaining = Math.min(RUNNER_RESPONSE_PER_RESULT_BYTES, Math.max(0, budget.remaining));
  let storedBytes = 0;
  const take = (value, limit) => {
    const result = takeUtf8(value, Math.min(limit, remaining));
    remaining -= result.bytes;
    budget.remaining -= result.bytes;
    storedBytes += result.bytes;
    return result;
  };
  const statusText = take(response.statusText, 512);
  const headers = {};
  let headersTruncated = Object.keys(response.headers).length > RUNNER_RESPONSE_HEADERS;
  for (const [rawName, rawValue] of Object.entries(response.headers).slice(0, RUNNER_RESPONSE_HEADERS)) {
    if (remaining <= 0) {
      headersTruncated = true;
      break;
    }
    const name = take(rawName, 256);
    const value = take(rawValue, 2048);
    headersTruncated ||= name.truncated || value.truncated;
    if (name.value) headers[name.value] = value.value;
  }
  const body = take(response.body, RUNNER_RESPONSE_BODY_BYTES);
  return {
    statusText: statusText.value,
    statusTextTruncated: statusText.truncated,
    headers,
    headersTruncated,
    bodyPreview: body.value,
    bodyTruncated: body.truncated,
    sizeBytes: response.sizeBytes,
    storedBytes
  };
};
var sensitiveName = (name) => /(^|[-_])(authorization|cookie|token|secret|password|passphrase|api[-_]?key)([-_]|$)/i.test(name);
var redactSensitiveQuery = (value) => {
  try {
    const url = new URL(value);
    [...url.searchParams.keys()].forEach((name) => {
      if (sensitiveName(name)) url.searchParams.set(name, "[redacted]");
    });
    return url.toString();
  } catch {
    return value;
  }
};
var base64Bytes = (value) => {
  const source = value.replace(/\s/g, "");
  return Math.max(0, Math.floor(source.length * 3 / 4) - (source.endsWith("==") ? 2 : source.endsWith("=") ? 1 : 0));
};
var requestBodyMetadata = (request, variables) => {
  if (request.protocol === "graphql") {
    const variablesText = resolveTemplate(request.graphql.variables || "{}", variables);
    const body = JSON.stringify({ query: request.graphql.query, variables: variablesText, operationName: request.graphql.operationName || void 0 });
    return { mode: "graphql", summary: "GraphQL query and variables", bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.protocol === "grpc") {
    const input = resolveTemplate(request.grpc.input, variables);
    return { mode: "grpc", summary: `${request.grpc.service}/${request.grpc.method}`, bytes: new TextEncoder().encode(input).byteLength, estimated: false };
  }
  if (request.protocol === "websocket") {
    const body = resolveTemplate(request.body, variables);
    return { mode: "websocket", summary: body ? "Startup text frame" : "No startup frame", bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.protocol === "socketio") {
    const args2 = request.socketIo.args.map((arg) => resolveTemplate(arg.value, variables));
    return { mode: "socketio", summary: `${request.socketIo.eventName || "message"} \xB7 ${args2.length} args${request.socketIo.ack ? " \xB7 ack" : ""}`, bytes: new TextEncoder().encode(JSON.stringify(args2)).byteLength, estimated: false };
  }
  if (request.bodyMode === "json" || request.bodyMode === "text") {
    const body = resolveTemplate(request.body, variables);
    return { mode: request.bodyMode, summary: `${request.bodyMode === "json" ? "JSON" : "Text"} body`, bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.bodyMode === "form-urlencoded") {
    const fields = request.formBody.filter((row) => row.enabled && row.name);
    const body = new URLSearchParams(fields.map((row) => [resolveTemplate(row.name, variables), resolveTemplate(row.value, variables)])).toString();
    return { mode: request.bodyMode, summary: `${fields.length} fields: ${fields.map((row) => row.name).join(", ")}`, bytes: new TextEncoder().encode(body).byteLength, estimated: false };
  }
  if (request.bodyMode === "multipart") {
    const parts = request.multipartBody.filter((part) => part.enabled && part.name);
    const bytes = parts.reduce((total, part) => total + (part.kind === "file" && part.file ? base64Bytes(part.file.dataBase64) : new TextEncoder().encode(resolveTemplate(part.value, variables)).byteLength), 0);
    return { mode: request.bodyMode, summary: `${parts.length} parts: ${parts.map((part) => part.kind === "file" ? `${part.name} (${part.fileName || part.file?.fileName || "file"})` : part.name).join(", ")}`, bytes, estimated: true };
  }
  if (request.bodyMode === "binary" && request.binaryBody) return { mode: request.bodyMode, summary: request.binaryBody.fileName || "Binary file", bytes: base64Bytes(request.binaryBody.dataBase64), estimated: false };
  return { mode: request.bodyMode, summary: "No request body", bytes: 0, estimated: false };
};
var captureRunnerRequest = (request, variables, requestUrl, budget) => {
  let remaining = Math.min(RUNNER_REQUEST_PER_RESULT_BYTES, Math.max(0, budget.remaining));
  let storedBytes = 0;
  const take = (value, limit) => {
    const result = takeUtf8(value, Math.min(limit, remaining));
    remaining -= result.bytes;
    budget.remaining -= result.bytes;
    storedBytes += result.bytes;
    return result;
  };
  let resolvedUrl = requestUrl ?? request.url;
  try {
    resolvedUrl = requestUrl ?? buildRequestUrl(request, variables);
  } catch {
  }
  const url = take(redactSensitiveQuery(resolvedUrl), 4e3);
  let configuredHeaders = [];
  try {
    configuredHeaders = buildHeaders(request, variables).filter((header) => header.enabled && header.name);
  } catch {
  }
  const headers = [];
  let headersTruncated = configuredHeaders.length > 64;
  for (const header of configuredHeaders.slice(0, 64)) {
    if (remaining <= 0) {
      headersTruncated = true;
      break;
    }
    const name = take(header.name, 256);
    const redacted = sensitiveName(header.name);
    const value = take(redacted ? "[redacted]" : header.value, 2048);
    headersTruncated ||= name.truncated || value.truncated;
    if (name.value) headers.push({ name: name.value, value: value.value, redacted });
  }
  const body = requestBodyMetadata(request, variables);
  const bodySummary = take(body.summary, 2e3);
  return { protocol: request.protocol, method: request.method, url: url.value, urlTruncated: url.truncated, headers, headersTruncated, bodyMode: body.mode, bodySummary: bodySummary.value, bodySizeBytes: body.bytes, bodySizeEstimated: body.estimated, storedBytes };
};
var runCollection = async (collection2, environment, options, executeRequest, executeScript) => {
  const startedAt = (/* @__PURE__ */ new Date()).toISOString();
  const results = [];
  let cancelled = false;
  let bailed = false;
  const responseSnapshotBudget = { remaining: RUNNER_RESPONSE_REPORT_BYTES };
  const requestSnapshotBudget = { remaining: RUNNER_REQUEST_REPORT_BYTES };
  const iterations = boundedInteger(options.iterations, 1, 1e3);
  const retries = boundedInteger(options.retries, 0, 10);
  const testNamePattern = validateTestNamePattern(options.testNamePattern);
  const requestsById = new Map(collection2.requests.map((request) => [request.id, request]));
  const plannedRequests = options.requestIds === void 0 ? collection2.requests : [...new Set(options.requestIds)].flatMap((id) => requestsById.get(id) ?? []);
  const configuredGlobalScopes = options.environmentScopes;
  const globalsAreBase = configuredGlobalScopes?.globalsAreBase ?? true;
  let baseGlobalVariables = { ...configuredGlobalScopes?.baseGlobals.values ?? environmentMap(environment) };
  let globalVariables = globalsAreBase ? baseGlobalVariables : { ...configuredGlobalScopes?.globals.values ?? {} };
  let baseGlobalDisabled = [...configuredGlobalScopes?.baseGlobals.disabled ?? []];
  let globalDisabled = [...configuredGlobalScopes?.globals.disabled ?? []];
  const configuredCollectionScopes = collectionEnvironmentScopes(collection2);
  const collectionVariablesAreBase = configuredCollectionScopes.environmentIsBase;
  let baseEnvironment = { ...configuredCollectionScopes.baseEnvironment.values };
  let collectionVariables = collectionVariablesAreBase ? baseEnvironment : { ...configuredCollectionScopes.environment.values };
  let baseEnvironmentDisabled = [...configuredCollectionScopes.baseEnvironment.disabled];
  let collectionDisabled = [...configuredCollectionScopes.environment.disabled];
  const folderVariables = new Map((collection2.folders ?? []).map((folder) => [folder.id, Object.fromEntries(folder.environment.filter((row) => row.enabled && row.name).map((row) => [row.name, row.value]))]));
  const folderDisabled = new Map((collection2.folders ?? []).map((folder) => [folder.id, new Set(folder.environment.filter((row) => !row.enabled && row.name).map((row) => row.name))]));
  outer: for (let iteration = 0; iteration < iterations; iteration += 1) {
    const iterationData = options.dataRows[iteration % Math.max(1, options.dataRows.length)] ?? {};
    for (const originalRequest of plannedRequests) {
      if (options.shouldCancel?.()) {
        cancelled = true;
        break outer;
      }
      for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
        const configured = applyCollectionConfiguration(collection2, originalRequest, environment);
        let request = structuredClone(configured.request);
        let response;
        let tests = [];
        let error;
        let requestVariables = {};
        const started = Date.now();
        try {
          const scriptFolders = configured.folders.map((folder) => ({ id: folder.id, name: folder.name, environment: { ...folderVariables.get(folder.id) ?? {} }, disabled: [...folderDisabled.get(folder.id) ?? []] }));
          const scriptScopes = {
            baseGlobals: baseGlobalVariables,
            baseGlobalDisabled,
            globalDisabled,
            globalsAreBase,
            baseEnvironment,
            baseEnvironmentDisabled,
            collectionVariables,
            collectionDisabled,
            collectionVariablesAreBase,
            folders: scriptFolders
          };
          const preRequest = await executeScript(request.preRequestScript, request, globalVariables, void 0, options.scriptTimeoutMs ?? 1e4, {}, iterationData, scriptScopes);
          request = preRequest.request;
          baseGlobalVariables = preRequest.baseGlobals ?? (globalsAreBase ? preRequest.environment : baseGlobalVariables);
          globalVariables = preRequest.environment;
          baseGlobalDisabled = preRequest.baseGlobalDisabled ?? baseGlobalDisabled;
          globalDisabled = preRequest.globalDisabled ?? globalDisabled;
          baseEnvironment = preRequest.baseEnvironment ?? (collectionVariablesAreBase ? preRequest.collectionVariables : void 0) ?? baseEnvironment;
          collectionVariables = collectionVariablesAreBase ? baseEnvironment : preRequest.collectionVariables ?? collectionVariables;
          baseEnvironmentDisabled = preRequest.baseEnvironmentDisabled ?? baseEnvironmentDisabled;
          collectionDisabled = preRequest.collectionDisabled ?? collectionDisabled;
          preRequest.folders?.forEach((folder) => {
            folderVariables.set(folder.id, folder.environment);
            folderDisabled.set(folder.id, new Set(folder.disabled ?? []));
          });
          const localVariables = preRequest.localVariables ?? {};
          requestVariables = {};
          const applyScope = (scope, disabled) => {
            disabled.forEach((name) => delete requestVariables[name]);
            Object.assign(requestVariables, scope);
          };
          applyScope(baseGlobalVariables, baseGlobalDisabled);
          if (!globalsAreBase) applyScope(globalVariables, globalDisabled);
          applyScope(baseEnvironment, baseEnvironmentDisabled);
          if (!collectionVariablesAreBase) applyScope(collectionVariables, collectionDisabled);
          scriptFolders.forEach((folder) => {
            folderDisabled.get(folder.id)?.forEach((name) => delete requestVariables[name]);
            Object.assign(requestVariables, folderVariables.get(folder.id) ?? {});
          });
          Object.assign(requestVariables, iterationData, localVariables);
          response = await executeRequest(request, requestVariables);
          const afterResponse = await executeScript(request.tests, request, globalVariables, response, options.scriptTimeoutMs ?? 1e4, localVariables, iterationData, {
            baseGlobals: baseGlobalVariables,
            baseGlobalDisabled,
            globalDisabled,
            globalsAreBase,
            baseEnvironment,
            baseEnvironmentDisabled,
            collectionVariables,
            collectionDisabled,
            collectionVariablesAreBase,
            folders: scriptFolders.map((folder) => ({ ...folder, environment: { ...folderVariables.get(folder.id) ?? {} }, disabled: [...folderDisabled.get(folder.id) ?? []] })),
            testNamePattern
          });
          baseGlobalVariables = afterResponse.baseGlobals ?? (globalsAreBase ? afterResponse.environment : baseGlobalVariables);
          globalVariables = afterResponse.environment;
          baseGlobalDisabled = afterResponse.baseGlobalDisabled ?? baseGlobalDisabled;
          globalDisabled = afterResponse.globalDisabled ?? globalDisabled;
          baseEnvironment = afterResponse.baseEnvironment ?? (collectionVariablesAreBase ? afterResponse.collectionVariables : void 0) ?? baseEnvironment;
          collectionVariables = collectionVariablesAreBase ? baseEnvironment : afterResponse.collectionVariables ?? collectionVariables;
          baseEnvironmentDisabled = afterResponse.baseEnvironmentDisabled ?? baseEnvironmentDisabled;
          collectionDisabled = afterResponse.collectionDisabled ?? collectionDisabled;
          afterResponse.folders?.forEach((folder) => {
            folderVariables.set(folder.id, folder.environment);
            folderDisabled.set(folder.id, new Set(folder.disabled ?? []));
          });
          tests = afterResponse.tests;
        } catch (caught) {
          error = caught instanceof Error ? caught.message : String(caught);
        }
        const passed = !error && response !== void 0 && response.status > 0 && response.status < 400 && tests.every((test) => test.passed);
        const retainResult = testNamePattern === void 0 || tests.length > 0 || !passed;
        const result = {
          id: runId(),
          requestId: request.id,
          requestName: request.name,
          iteration: iteration + 1,
          attempt,
          status: response?.status ?? 0,
          durationMs: response?.durationMs ?? Date.now() - started,
          passed,
          error,
          tests,
          request: retainResult ? captureRunnerRequest(request, requestVariables, response?.requestUrl, requestSnapshotBudget) : void 0,
          response: retainResult && response ? captureRunnerResponse(response, responseSnapshotBudget) : void 0
        };
        if (retainResult) {
          results.push(result);
          options.onResult?.(result);
        }
        if (passed || attempt > retries) {
          if (!passed && options.bail) {
            bailed = true;
            break outer;
          }
          break;
        }
        if (options.delayMs > 0) await wait(options.delayMs);
      }
      if (options.delayMs > 0) await wait(options.delayMs);
    }
  }
  return {
    id: runId(),
    collectionId: collection2.id,
    collectionName: collection2.name,
    environmentId: environment.id,
    startedAt,
    finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
    iterations,
    retries,
    testNamePattern,
    matchedTests: results.reduce((total, result) => total + result.tests.length, 0),
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    cancelled,
    bailed,
    results
  };
};
var parseCsvLine = (line) => {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
};
var parseRunnerData = (contents) => {
  if (!contents.trim()) return [];
  if (contents.trimStart().startsWith("[") || contents.trimStart().startsWith("{")) {
    const parsed = JSON.parse(contents);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value ?? "")])));
  }
  const lines = contents.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ""])));
};

// src/lib/runnerReport.ts
var runnerReporters = ["dot", "list", "min", "progress", "spec", "tap", "json", "junit"];
var cleanText = (value) => Array.from(String(value ?? ""), (character) => {
  const point = character.codePointAt(0) ?? 0;
  const xmlCharacter = point === 9 || point === 10 || point === 13 || point >= 32 && point <= 55295 || point >= 57344 && point <= 65533 || point >= 65536 && point <= 1114111;
  return xmlCharacter && point !== 127 ? character : "\uFFFD";
}).join("");
var xmlText = (value) => cleanText(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
var xmlAttribute = (value) => xmlText(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;").replaceAll("	", "&#9;").replaceAll("\n", "&#10;").replaceAll("\r", "&#13;");
var seconds = (milliseconds) => (Math.max(0, milliseconds) / 1e3).toFixed(3);
var resultLabel = (result) => `${result.requestName} (iteration ${result.iteration}, attempt ${result.attempt})`;
var runDuration = (report) => {
  const duration = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : report.results.reduce((total, result) => total + Math.max(0, result.durationMs), 0);
};
var failureDetails = (result) => {
  if (result.error) return result.error;
  const failedTests = result.tests.filter((test) => !test.passed);
  if (failedTests.length) return failedTests.map((test) => `${test.name}: ${test.error || "assertion failed"}`).join("\n");
  if (result.status <= 0) return "The request did not return a response.";
  if (result.status >= 400) return `HTTP status ${result.status}.`;
  return "The runner marked this attempt as failed.";
};
var summary = (report) => `${report.passed} passed, ${report.failed} failed, ${report.total} total${report.testNamePattern === void 0 ? "" : `, ${report.matchedTests ?? report.results.reduce((total, result) => total + result.tests.length, 0)} matched tests`}${report.cancelled ? ", cancelled" : ""}${report.bailed ? ", bailed" : ""} (${runDuration(report)} ms)`;
var specReport = (report) => {
  const lines = [report.collectionName];
  report.results.forEach((result) => {
    lines.push(`  ${result.passed ? "\u2713" : "\u2716"} ${resultLabel(result)} (${result.durationMs} ms)`);
    if (!result.passed) cleanText(failureDetails(result)).split("\n").forEach((detail) => lines.push(`    ${detail}`));
  });
  lines.push("", summary(report));
  return `${lines.join("\n")}
`;
};
var tapLine = (value) => cleanText(value).replace(/\r?\n/g, " ");
var tapReport = (report) => {
  const lines = ["TAP version 13", `1..${report.total}`];
  report.results.forEach((result, index) => {
    lines.push(`${result.passed ? "ok" : "not ok"} ${index + 1} - ${tapLine(resultLabel(result))}`);
    if (!result.passed) {
      lines.push("  ---");
      lines.push(`  message: ${JSON.stringify(tapLine(failureDetails(result)))}`);
      lines.push(`  status: ${result.status}`);
      lines.push(`  duration_ms: ${Math.max(0, result.durationMs)}`);
      lines.push("  ...");
    }
  });
  lines.push(`# ${summary(report)}`);
  return `${lines.join("\n")}
`;
};
var junitReport = (report) => {
  const errors = report.results.filter((result) => Boolean(result.error)).length;
  const failures = report.results.filter((result) => !result.passed && !result.error).length;
  const cases = report.results.map((result) => {
    const attributes = `name="${xmlAttribute(resultLabel(result))}" classname="${xmlAttribute(report.collectionName)}" time="${seconds(result.durationMs)}"`;
    if (result.passed) return `    <testcase ${attributes} />`;
    const details = xmlText(failureDetails(result));
    if (result.error) return `    <testcase ${attributes}>
      <error type="runner" message="${xmlAttribute(result.error)}">${details}</error>
    </testcase>`;
    return `    <testcase ${attributes}>
      <failure type="assertion" message="${xmlAttribute(failureDetails(result).split("\n")[0])}">${details}</failure>
    </testcase>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${xmlAttribute(report.collectionName)}" tests="${report.total}" failures="${failures}" errors="${errors}" time="${seconds(runDuration(report))}">`,
    `  <testsuite name="${xmlAttribute(report.collectionName)}" id="${xmlAttribute(report.id)}" tests="${report.total}" failures="${failures}" errors="${errors}" skipped="0" time="${seconds(runDuration(report))}" timestamp="${xmlAttribute(report.startedAt)}">`,
    ...cases,
    "  </testsuite>",
    "</testsuites>",
    ""
  ].join("\n");
};
var reportContents = (report, reporter) => {
  if (reporter === "json") return `${JSON.stringify({ format: "brunomnia-run-report", version: 1, report }, null, 2)}
`;
  if (reporter === "junit") return junitReport(report);
  if (reporter === "tap") return tapReport(report);
  if (reporter === "spec") return specReport(report);
  if (reporter === "min") return `${summary(report)}
`;
  if (reporter === "dot") return `${report.results.map((result) => result.passed ? "." : "!").join("")}
${summary(report)}
`;
  if (reporter === "progress") {
    const width = 20;
    const complete = report.total ? Math.round(report.passed / report.total * width) : 0;
    return `[${"=".repeat(complete)}${"-".repeat(width - complete)}] ${summary(report)}
`;
  }
  return `${report.results.map((result) => `${result.passed ? "PASS" : "FAIL"} ${cleanText(resultLabel(result))} ${result.durationMs} ms${result.passed ? "" : ` \u2014 ${cleanText(failureDetails(result)).replace(/\r?\n/g, "; ")}`}`).join("\n")}
${summary(report)}
`;
};
var parseRunnerReporter = (value, fallback = "json") => {
  if (!value) return fallback;
  if (runnerReporters.includes(value)) return value;
  throw new Error(`Unknown runner reporter '${value}'. Choose ${runnerReporters.join(", ")}.`);
};
var createRunnerReportArtifact = (report, reporter) => {
  const slug = report.collectionName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "collection";
  const timestamp = report.startedAt.replace(/\.\d{3}Z$/, "Z").replace(/[^0-9TZ]/g, "");
  const extension = reporter === "json" ? "json" : reporter === "junit" ? "junit.xml" : reporter === "tap" ? "tap" : "txt";
  const mimeType = reporter === "json" ? "application/json" : reporter === "junit" ? "application/xml" : "text/plain";
  return { contents: reportContents(report, reporter), fileName: `${slug}-run-${timestamp}.${extension}`, mimeType };
};

// src/lib/scriptSandbox.ts
init_cookies();

// src/lib/scriptExpect.ts
var createScriptExpect = () => {
  const same = (left, right) => {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return left === right;
    }
  };
  const tag = (value) => Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
  const typeName = (value) => value && typeof value === "object" && Symbol.toStringTag in value ? String(value[Symbol.toStringTag]).toLowerCase() : tag(value);
  const sizeOf = (value) => value instanceof Map || value instanceof Set ? value.size : value?.length;
  const pathResult = (value, path) => {
    const parts = String(path).replace(/\\([.\[\]\\])/g, (_match, escaped) => `\0${escaped.charCodeAt(0)}\0`).replace(/\[(?:'([^']+)'|"([^"]+)"|(\w+))\]/g, (_match, single, quoted, plain) => `.${single ?? quoted ?? plain}`).split(".").filter(Boolean).map((part) => part.replace(/\u0000(\d+)\u0000/g, (_match, code) => String.fromCharCode(Number(code))));
    let current = value;
    for (const part of parts) {
      if (current == null || !(part in Object(current))) return { found: false, value: void 0 };
      current = current[part];
    }
    return { found: true, value: current };
  };
  const keysOf = (value) => value instanceof Map ? [...value.keys()] : value instanceof Set ? [...value.values()] : value && (typeof value === "object" || typeof value === "function") ? Object.keys(value) : [];
  const includes = (actual, expected, flags) => {
    const compare = (left, right) => flags.deep ? same(left, right) : left === right;
    if (typeof actual === "string") return actual.includes(String(expected));
    if (Array.isArray(actual)) return actual.some((item) => compare(item, expected));
    if (actual instanceof Set || actual instanceof Map) return [...actual.values()].some((item) => compare(item, expected));
    if (!actual || typeof actual !== "object" || !expected || typeof expected !== "object") return false;
    return Object.entries(expected).every(([name, value]) => {
      if (flags.nested) {
        const result = pathResult(actual, name);
        return result.found && compare(result.value, value);
      }
      const exists = flags.own ? Object.prototype.hasOwnProperty.call(actual, name) : name in Object(actual);
      return exists && compare(actual[name], value);
    });
  };
  const memberSubset = (actual, expected, deep) => expected.every((item) => actual.some((candidate) => deep ? same(candidate, item) : candidate === item));
  const readMutation = (target, property) => typeof target === "function" && property === void 0 ? target() : target?.[property ?? ""];
  const expect = ((initial, baseMessage) => {
    const make = (actual, flags = {}) => {
      let proxy;
      const verify = (condition, fallback, message) => {
        if (flags.negated ? Boolean(condition) : !condition) throw new Error(typeof message === "string" ? message : baseMessage || fallback);
      };
      const next = (value = actual, nextFlags = flags) => make(value, nextFlags);
      const method = (name, args2) => {
        if (name === "a") {
          const expected = String(args2[0]).toLowerCase();
          verify(typeName(actual) === expected, `Expected value to be a ${expected}`, args2[1]);
          return proxy;
        }
        if (name === "include") {
          verify(includes(actual, args2[0], flags), "Expected value to include the requested member", args2[1]);
          return proxy;
        }
        if (name === "equal") {
          verify(flags.deep ? same(actual, args2[0]) : actual === args2[0], "Expected values to equal", args2[1]);
          return proxy;
        }
        if (name === "eql") {
          verify(same(actual, args2[0]), "Expected values to deeply equal", args2[1]);
          return proxy;
        }
        if (name === "above") {
          verify(actual > args2[0], `Expected ${actual} to be above ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "least") {
          verify(actual >= args2[0], `Expected ${actual} to be at least ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "below") {
          verify(actual < args2[0], `Expected ${actual} to be below ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "most") {
          verify(actual <= args2[0], `Expected ${actual} to be at most ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "within") {
          verify(actual >= args2[0] && actual <= args2[1], `Expected ${actual} to be within the requested range`, args2[2]);
          return proxy;
        }
        if (name === "instanceof") {
          verify(typeof args2[0] === "function" && actual instanceof args2[0], "Expected value to be an instance of the constructor", args2[1]);
          return proxy;
        }
        if (name === "property" || name === "ownProperty") {
          const property = String(args2[0]);
          const result = flags.nested && name !== "ownProperty" ? pathResult(actual, property) : { found: actual != null && (name === "ownProperty" || flags.own ? Object.prototype.hasOwnProperty.call(actual, property) : property in Object(actual)), value: actual == null ? void 0 : actual[property] };
          verify(result.found && (args2.length < 2 || (flags.deep ? same(result.value, args2[1]) : result.value === args2[1])), `Expected value to have property ${property}`, args2[2]);
          return next(result.value);
        }
        if (name === "ownPropertyDescriptor") {
          const descriptor = actual == null ? void 0 : Object.getOwnPropertyDescriptor(Object(actual), String(args2[0]));
          verify(Boolean(descriptor) && (args2.length < 2 || same(descriptor, args2[1])), `Expected an own property descriptor for ${args2[0]}`, args2[2]);
          return next(descriptor);
        }
        if (name === "lengthOf") {
          const length = sizeOf(actual);
          verify(length === args2[0], `Expected length or size ${args2[0]} but got ${length}`, args2[1]);
          return proxy;
        }
        if (name === "match") {
          verify(args2[0] instanceof RegExp && args2[0].test(String(actual)), `Expected value to match ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "string") {
          verify(typeof actual === "string" && actual.includes(String(args2[0])), `Expected string to contain ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "keys") {
          const single = args2[0];
          const expected = (args2.length === 1 && Array.isArray(single) ? single : args2.length === 1 && single && typeof single === "object" && !(single instanceof Map) && !(single instanceof Set) ? Object.keys(single) : args2).map((value) => value);
          const actualKeys = keysOf(actual);
          const has = (key) => actualKeys.some((candidate) => flags.deep ? same(candidate, key) : candidate === key || String(candidate) === String(key));
          const condition = flags.any ? expected.some(has) : expected.every(has) && (flags.contains || actualKeys.length === expected.length);
          verify(condition, `Expected value to have ${flags.any ? "any" : "all"} requested keys`);
          return proxy;
        }
        if (name === "throw") {
          let thrown;
          try {
            actual();
          } catch (error) {
            thrown = error;
          }
          const expected = args2[0];
          const matcher = expected instanceof RegExp || typeof expected === "string" ? expected : args2[1];
          const typeMatches = thrown !== void 0 && (!expected || expected instanceof RegExp || typeof expected === "string" || typeof expected === "function" && thrown instanceof expected || thrown === expected);
          const text2 = String(thrown?.message ?? thrown);
          const messageMatches = !matcher || (matcher instanceof RegExp ? matcher.test(text2) : text2.includes(String(matcher)));
          verify(typeMatches && messageMatches, "Expected function to throw a matching error", args2[2]);
          return next(thrown);
        }
        if (name === "respondTo") {
          const target2 = typeof actual === "function" && !flags.itself ? actual.prototype : actual;
          verify(typeof target2?.[String(args2[0])] === "function", `Expected value to respond to ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "satisfy") {
          verify(typeof args2[0] === "function" && Boolean(args2[0](actual)), "Expected value to satisfy predicate", args2[1]);
          return proxy;
        }
        if (name === "closeTo") {
          verify(typeof actual === "number" && Math.abs(actual - Number(args2[0])) <= Number(args2[1]), `Expected ${actual} to be close to ${args2[0]}`, args2[2]);
          return proxy;
        }
        if (name === "members") {
          const expected = Array.isArray(args2[0]) ? args2[0] : [];
          const values = Array.isArray(actual) ? actual : [];
          const condition = flags.ordered ? same(values.slice(0, flags.contains ? expected.length : values.length), expected) : memberSubset(values, expected, Boolean(flags.deep)) && (flags.contains || values.length === expected.length);
          verify(condition, "Expected arrays to have the requested members", args2[1]);
          return proxy;
        }
        if (name === "oneOf") {
          verify(Array.isArray(args2[0]) && args2[0].includes(actual), "Expected value to be one of the requested values", args2[1]);
          return proxy;
        }
        if (name === "change" || name === "increase" || name === "decrease") {
          const target2 = args2[0];
          const property = typeof target2 === "function" ? void 0 : typeof args2[1] === "string" ? args2[1] : void 0;
          const before = readMutation(target2, property);
          actual();
          const after = readMutation(target2, property);
          const delta = Number(after) - Number(before);
          const condition = name === "change" ? !same(before, after) : name === "increase" ? delta > 0 : delta < 0;
          verify(condition, `Expected function to ${name}`, typeof target2 === "function" ? args2[1] : args2[2]);
          return next(delta, { ...flags, mutation: name });
        }
        if (name === "by") {
          const expected = flags.mutation === "decrease" ? -Math.abs(Number(args2[0])) : Number(args2[0]);
          verify(actual === expected, `Expected change by ${args2[0]}`, args2[1]);
          return proxy;
        }
        if (name === "toBe") {
          verify(actual === args2[0], "Expected values to be identical", args2[1]);
          return proxy;
        }
        if (name === "toEqual") {
          verify(same(actual, args2[0]), "Expected values to deeply equal", args2[1]);
          return proxy;
        }
        if (name === "toContain") {
          verify(includes(actual, args2[0], flags), "Expected value to contain member", args2[1]);
          return proxy;
        }
        if (name === "toBeTruthy") {
          verify(Boolean(actual), "Expected value to be truthy");
          return proxy;
        }
        if (name === "toBeLessThan") {
          verify(Number(actual) < Number(args2[0]), `Expected ${actual} to be less than ${args2[0]}`);
          return proxy;
        }
        if (name === "toBeGreaterThan") {
          verify(Number(actual) > Number(args2[0]), `Expected ${actual} to be greater than ${args2[0]}`);
          return proxy;
        }
        return proxy;
      };
      const aliases = {
        an: "a",
        includes: "include",
        contain: "include",
        contains: "include",
        equals: "equal",
        eq: "equal",
        eqls: "eql",
        gt: "above",
        greaterThan: "above",
        gte: "least",
        lt: "below",
        lessThan: "below",
        lte: "most",
        instanceOf: "instanceof",
        ownProperty: "ownProperty",
        haveOwnProperty: "ownProperty",
        haveOwnPropertyDescriptor: "ownPropertyDescriptor",
        length: "lengthOf",
        matches: "match",
        key: "keys",
        throws: "throw",
        Throw: "throw",
        respondsTo: "respondTo",
        satisfies: "satisfy",
        approximately: "closeTo",
        changes: "change",
        increases: "increase",
        decreases: "decrease"
      };
      const methods = /* @__PURE__ */ new Set(["a", "include", "equal", "eql", "above", "least", "below", "most", "within", "instanceof", "property", "ownProperty", "ownPropertyDescriptor", "lengthOf", "match", "string", "keys", "throw", "respondTo", "satisfy", "closeTo", "members", "oneOf", "change", "increase", "decrease", "by", "toBe", "toEqual", "toContain", "toBeTruthy", "toBeLessThan", "toBeGreaterThan"]);
      const language = /* @__PURE__ */ new Set(["to", "be", "been", "is", "that", "which", "and", "has", "have", "with", "at", "of", "same", "but", "does", "still", "also"]);
      const target = {};
      proxy = new Proxy(target, {
        get(_object, key) {
          if (typeof key !== "string") return void 0;
          if (language.has(key)) return proxy;
          if (key === "not") return next(actual, { ...flags, negated: !flags.negated });
          if (key === "all") return next(actual, { ...flags, any: false });
          if (["deep", "nested", "own", "ordered", "any", "itself"].includes(key)) return next(actual, { ...flags, [key]: true });
          const getterConditions = {
            ok: [Boolean(actual), "Expected value to be truthy"],
            true: [actual === true, "Expected value to be true"],
            false: [actual === false, "Expected value to be false"],
            null: [actual === null, "Expected value to be null"],
            undefined: [actual === void 0, "Expected value to be undefined"],
            NaN: [typeof actual === "number" && Number.isNaN(actual), "Expected value to be NaN"],
            exist: [actual !== null && actual !== void 0, "Expected value to exist"],
            empty: [(sizeOf(actual) ?? (actual && typeof actual === "object" ? Object.keys(actual).length : void 0)) === 0, "Expected value to be empty"],
            arguments: [tag(actual) === "arguments", "Expected value to be arguments"],
            extensible: [Boolean(actual && typeof actual === "object" && Object.isExtensible(actual)), "Expected value to be extensible"],
            sealed: [Boolean(actual && typeof actual === "object" && Object.isSealed(actual)), "Expected value to be sealed"],
            frozen: [Boolean(actual && typeof actual === "object" && Object.isFrozen(actual)), "Expected value to be frozen"],
            finite: [typeof actual === "number" && Number.isFinite(actual), "Expected value to be finite"]
          };
          if (key === "exists") return Reflect.get(proxy, "exist");
          if (key === "Arguments") return Reflect.get(proxy, "arguments");
          if (key in getterConditions) {
            const [condition, message] = getterConditions[key];
            verify(condition, message);
            return proxy;
          }
          const canonical = aliases[key] ?? key;
          if (!methods.has(canonical)) return void 0;
          const callable = (...args2) => method(canonical, args2);
          return new Proxy(callable, {
            get(_function, child) {
              const chainFlags = canonical === "include" ? { ...flags, contains: true } : flags;
              const chainActual = canonical === "lengthOf" ? sizeOf(actual) : actual;
              return Reflect.get(make(chainActual, chainFlags), child);
            }
          });
        }
      });
      return proxy;
    };
    return make(initial);
  });
  expect.fail = (...args2) => {
    throw new Error(typeof args2[0] === "string" && args2.length === 1 ? args2[0] : typeof args2[2] === "string" ? args2[2] : "Assertion failed");
  };
  return expect;
};

// src/lib/scriptModules.ts
var createScriptModules = (runtime) => {
  const maximumInput = 5e6;
  const boundedText = (value) => {
    const text2 = String(value ?? "");
    if (text2.length > maximumInput) throw new Error("Script module input exceeds 5 MB.");
    return text2;
  };
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const typeName = (value) => value === null ? "null" : Array.isArray(value) ? "array" : value instanceof RegExp ? "regexp" : value instanceof Date ? "date" : value instanceof Map ? "map" : value instanceof Set ? "set" : typeof value;
  const pathValue = (value, path) => String(path).replace(/\[(?:'([^']+)'|"([^"]+)"|(\w+))\]/g, (_match, single, quoted, plain) => `.${single ?? quoted ?? plain}`).split(".").filter(Boolean).reduce((current, key) => current?.[key], value);
  const includes = (haystack, needle, deep = false) => {
    if (typeof haystack === "string") return haystack.includes(String(needle));
    if (Array.isArray(haystack)) return haystack.some((item) => deep ? same(item, needle) : item === needle);
    if (haystack instanceof Set) return [...haystack].some((item) => deep ? same(item, needle) : item === needle);
    if (haystack && typeof haystack === "object" && needle && typeof needle === "object") return Object.entries(needle).every(([key, value]) => Object.prototype.hasOwnProperty.call(haystack, key) && (deep ? same(haystack[key], value) : haystack[key] === value));
    return false;
  };
  const nestedIncludes = (haystack, needle, deep = false) => Boolean(needle && typeof needle === "object") && Object.entries(needle).every(([path, expected]) => deep ? same(pathValue(haystack, path), expected) : pathValue(haystack, path) === expected);
  const objectKeys = (value) => value instanceof Map ? [...value.keys()] : value instanceof Set ? [...value.values()] : value && typeof value === "object" ? Object.keys(value) : [];
  const expectedKeys = (value) => Array.isArray(value) ? value : value && typeof value === "object" && !(value instanceof Map) && !(value instanceof Set) ? Object.keys(value) : [value];
  const hasKey = (keys, expected, deep = false) => keys.some((key) => deep ? same(key, expected) : key === expected);
  const memberSubset = (actual, expected, deep = false) => Array.isArray(actual) && Array.isArray(expected) && expected.every((item) => actual.some((candidate) => deep ? same(candidate, item) : candidate === item));
  const lengthOrSize = (value) => value instanceof Map || value instanceof Set ? value.size : value?.length;
  const assertCondition = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const measuredValue = (target, property) => property === void 0 && typeof target === "function" ? target() : target?.[property ?? ""];
  const measureMutation = (modifier2, target, property) => {
    const before = measuredValue(target, property);
    modifier2();
    return { before, after: measuredValue(target, property) };
  };
  const measureChange = (modifier2, target, property) => {
    const measured = measureMutation(modifier2, target, property);
    return Number(measured.after) - Number(measured.before);
  };
  const mutationProperty = (target, property) => typeof target === "function" ? void 0 : typeof property === "string" ? property : void 0;
  const mutationDelta = (target, propertyOrDelta, deltaOrMessage) => Number(typeof target === "function" ? propertyOrDelta : deltaOrMessage);
  const mutationMessage = (target, propertyOrMessage, message) => typeof (typeof target === "function" ? propertyOrMessage : message) === "string" ? String(typeof target === "function" ? propertyOrMessage : message) : void 0;
  const deltaMessage = (target, deltaOrMessage, message) => typeof (typeof target === "function" ? deltaOrMessage : message) === "string" ? String(typeof target === "function" ? deltaOrMessage : message) : void 0;
  const assertion = Object.assign((condition, message) => {
    if (!condition) throw new Error(message || "Assertion failed");
  }, {
    ok(condition, message) {
      if (!condition) throw new Error(message || "Expected value to be truthy");
    },
    equal(actual, expected, message) {
      if (actual != expected) throw new Error(message || "Expected values to be equal");
    },
    notEqual(actual, expected, message) {
      if (actual == expected) throw new Error(message || "Expected values not to be equal");
    },
    strictEqual(actual, expected, message) {
      if (actual !== expected) throw new Error(message || "Expected values to be strictly equal");
    },
    notStrictEqual(actual, expected, message) {
      if (actual === expected) throw new Error(message || "Expected values not to be strictly equal");
    },
    deepEqual(actual, expected, message) {
      if (!same(actual, expected)) throw new Error(message || "Expected values to be deeply equal");
    },
    deepStrictEqual(actual, expected, message) {
      if (!same(actual, expected)) throw new Error(message || "Expected values to be deeply equal");
    },
    fail(message) {
      throw new Error(message || "Assertion failed");
    },
    match(value, expression, message) {
      if (!expression.test(String(value))) throw new Error(message || "Expected value to match expression");
    },
    doesNotMatch(value, expression, message) {
      if (expression.test(String(value))) throw new Error(message || "Expected value not to match expression");
    },
    throws(callback, expression) {
      try {
        callback();
      } catch (error) {
        if (!expression || expression.test(String(error))) return error;
        throw error;
      }
      throw new Error("Expected function to throw");
    },
    doesNotThrow(callback) {
      callback();
    },
    async rejects(callback, expression) {
      try {
        await (typeof callback === "function" ? callback() : callback);
      } catch (error) {
        if (!expression || expression.test(String(error))) return error;
        throw error;
      }
      throw new Error("Expected promise to reject");
    }
  });
  Object.assign(assertion, {
    notOk(value, message) {
      assertCondition(!value, message || "Expected value to be falsy");
    },
    isOk(value, message) {
      assertCondition(Boolean(value), message || "Expected value to be truthy");
    },
    isNotOk(value, message) {
      assertCondition(!value, message || "Expected value to be falsy");
    },
    notDeepEqual(actual, expected, message) {
      assertCondition(!same(actual, expected), message || "Expected values not to be deeply equal");
    },
    notDeepStrictEqual(actual, expected, message) {
      assertCondition(!same(actual, expected), message || "Expected values not to be deeply equal");
    },
    isTrue(value, message) {
      assertCondition(value === true, message || "Expected value to be true");
    },
    isNotTrue(value, message) {
      assertCondition(value !== true, message || "Expected value not to be true");
    },
    isFalse(value, message) {
      assertCondition(value === false, message || "Expected value to be false");
    },
    isNotFalse(value, message) {
      assertCondition(value !== false, message || "Expected value not to be false");
    },
    isNull(value, message) {
      assertCondition(value === null, message || "Expected value to be null");
    },
    isNotNull(value, message) {
      assertCondition(value !== null, message || "Expected value not to be null");
    },
    isNaN(value, message) {
      assertCondition(typeof value === "number" && Number.isNaN(value), message || "Expected value to be NaN");
    },
    isNotNaN(value, message) {
      assertCondition(!(typeof value === "number" && Number.isNaN(value)), message || "Expected value not to be NaN");
    },
    exists(value, message) {
      assertCondition(value !== null && value !== void 0, message || "Expected value to exist");
    },
    notExists(value, message) {
      assertCondition(value === null || value === void 0, message || "Expected value not to exist");
    },
    isUndefined(value, message) {
      assertCondition(value === void 0, message || "Expected value to be undefined");
    },
    isDefined(value, message) {
      assertCondition(value !== void 0, message || "Expected value to be defined");
    },
    isFunction(value, message) {
      assertCondition(typeof value === "function", message || "Expected value to be a function");
    },
    isNotFunction(value, message) {
      assertCondition(typeof value !== "function", message || "Expected value not to be a function");
    },
    isObject(value, message) {
      assertCondition(typeName(value) === "object", message || "Expected value to be an object");
    },
    isNotObject(value, message) {
      assertCondition(typeName(value) !== "object", message || "Expected value not to be an object");
    },
    isArray(value, message) {
      assertCondition(Array.isArray(value), message || "Expected value to be an array");
    },
    isNotArray(value, message) {
      assertCondition(!Array.isArray(value), message || "Expected value not to be an array");
    },
    isString(value, message) {
      assertCondition(typeof value === "string", message || "Expected value to be a string");
    },
    isNotString(value, message) {
      assertCondition(typeof value !== "string", message || "Expected value not to be a string");
    },
    isNumber(value, message) {
      assertCondition(typeof value === "number", message || "Expected value to be a number");
    },
    isNotNumber(value, message) {
      assertCondition(typeof value !== "number", message || "Expected value not to be a number");
    },
    isFinite(value, message) {
      assertCondition(typeof value === "number" && Number.isFinite(value), message || "Expected value to be finite");
    },
    isBoolean(value, message) {
      assertCondition(typeof value === "boolean", message || "Expected value to be a boolean");
    },
    isNotBoolean(value, message) {
      assertCondition(typeof value !== "boolean", message || "Expected value not to be a boolean");
    },
    typeOf(value, expected, message) {
      assertCondition(typeName(value) === expected.toLowerCase(), message || `Expected value to have type ${expected}`);
    },
    notTypeOf(value, expected, message) {
      assertCondition(typeName(value) !== expected.toLowerCase(), message || `Expected value not to have type ${expected}`);
    },
    instanceOf(value, expected, message) {
      assertCondition(value instanceof expected, message || `Expected value to be an instance of ${expected.name}`);
    },
    notInstanceOf(value, expected, message) {
      assertCondition(!(value instanceof expected), message || `Expected value not to be an instance of ${expected.name}`);
    },
    include(haystack, needle, message) {
      assertCondition(includes(haystack, needle), message || "Expected value to include member");
    },
    notInclude(haystack, needle, message) {
      assertCondition(!includes(haystack, needle), message || "Expected value not to include member");
    },
    deepInclude(haystack, needle, message) {
      assertCondition(includes(haystack, needle, true), message || "Expected value to deeply include member");
    },
    notDeepInclude(haystack, needle, message) {
      assertCondition(!includes(haystack, needle, true), message || "Expected value not to deeply include member");
    },
    nestedInclude(haystack, needle, message) {
      assertCondition(nestedIncludes(haystack, needle), message || "Expected value to include nested properties");
    },
    notNestedInclude(haystack, needle, message) {
      assertCondition(!nestedIncludes(haystack, needle), message || "Expected value not to include nested properties");
    },
    deepNestedInclude(haystack, needle, message) {
      assertCondition(nestedIncludes(haystack, needle, true), message || "Expected value to deeply include nested properties");
    },
    notDeepNestedInclude(haystack, needle, message) {
      assertCondition(!nestedIncludes(haystack, needle, true), message || "Expected value not to deeply include nested properties");
    },
    ownInclude(haystack, needle, message) {
      assertCondition(includes(haystack, needle), message || "Expected value to include own properties");
    },
    notOwnInclude(haystack, needle, message) {
      assertCondition(!includes(haystack, needle), message || "Expected value not to include own properties");
    },
    deepOwnInclude(haystack, needle, message) {
      assertCondition(includes(haystack, needle, true), message || "Expected value to deeply include own properties");
    },
    notDeepOwnInclude(haystack, needle, message) {
      assertCondition(!includes(haystack, needle, true), message || "Expected value not to deeply include own properties");
    },
    notMatch(value, expression, message) {
      assertCondition(!expression.test(String(value)), message || "Expected value not to match expression");
    },
    property(value, name, message) {
      assertCondition(value != null && name in Object(value), message || `Expected property '${name}'`);
    },
    notProperty(value, name, message) {
      assertCondition(value == null || !(name in Object(value)), message || `Expected no property '${name}'`);
    },
    propertyVal(value, name, expected, message) {
      assertCondition(value != null && name in Object(value) && value[name] === expected, message || `Expected property '${name}' to equal value`);
    },
    notPropertyVal(value, name, expected, message) {
      assertCondition(value == null || !(name in Object(value)) || value[name] !== expected, message || `Expected property '${name}' not to equal value`);
    },
    deepPropertyVal(value, name, expected, message) {
      assertCondition(value != null && name in Object(value) && same(value[name], expected), message || `Expected property '${name}' to deeply equal value`);
    },
    notDeepPropertyVal(value, name, expected, message) {
      assertCondition(value == null || !(name in Object(value)) || !same(value[name], expected), message || `Expected property '${name}' not to deeply equal value`);
    },
    nestedProperty(value, path, message) {
      assertCondition(pathValue(value, path) !== void 0, message || `Expected nested property '${path}'`);
    },
    notNestedProperty(value, path, message) {
      assertCondition(pathValue(value, path) === void 0, message || `Expected no nested property '${path}'`);
    },
    nestedPropertyVal(value, path, expected, message) {
      assertCondition(pathValue(value, path) === expected, message || `Expected nested property '${path}' to equal value`);
    },
    notNestedPropertyVal(value, path, expected, message) {
      assertCondition(pathValue(value, path) !== expected, message || `Expected nested property '${path}' not to equal value`);
    },
    deepNestedPropertyVal(value, path, expected, message) {
      assertCondition(same(pathValue(value, path), expected), message || `Expected nested property '${path}' to deeply equal value`);
    },
    notDeepNestedPropertyVal(value, path, expected, message) {
      assertCondition(!same(pathValue(value, path), expected), message || `Expected nested property '${path}' not to deeply equal value`);
    },
    lengthOf(value, expected, message) {
      assertCondition(lengthOrSize(value) === expected, message || `Expected length or size ${expected}`);
    },
    hasAnyKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(expectedKeys(keys).some((key) => hasKey(actual, key)), message || "Expected value to have any key");
    },
    hasAllKeys(value, keys, message) {
      const actual = objectKeys(value);
      const expected = expectedKeys(keys);
      assertCondition(actual.length === expected.length && expected.every((key) => hasKey(actual, key)), message || "Expected value to have all keys");
    },
    containsAllKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(expectedKeys(keys).every((key) => hasKey(actual, key)), message || "Expected value to contain all keys");
    },
    containsAnyKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(expectedKeys(keys).some((key) => hasKey(actual, key)), message || "Expected value to contain any key");
    },
    doesNotHaveAnyKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(expectedKeys(keys).every((key) => !hasKey(actual, key)), message || "Expected value to have none of the keys");
    },
    doesNotHaveAllKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(!expectedKeys(keys).every((key) => hasKey(actual, key)), message || "Expected value not to have all keys");
    },
    hasAnyDeepKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(expectedKeys(keys).some((key) => hasKey(actual, key, true)), message || "Expected value to have any deep key");
    },
    hasAllDeepKeys(value, keys, message) {
      const actual = objectKeys(value);
      const expected = expectedKeys(keys);
      assertCondition(actual.length === expected.length && expected.every((key) => hasKey(actual, key, true)), message || "Expected value to have all deep keys");
    },
    containsAllDeepKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(expectedKeys(keys).every((key) => hasKey(actual, key, true)), message || "Expected value to contain all deep keys");
    },
    doesNotHaveAnyDeepKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(expectedKeys(keys).every((key) => !hasKey(actual, key, true)), message || "Expected value to have none of the deep keys");
    },
    doesNotHaveAllDeepKeys(value, keys, message) {
      const actual = objectKeys(value);
      assertCondition(!expectedKeys(keys).every((key) => hasKey(actual, key, true)), message || "Expected value not to have all deep keys");
    },
    operator(left, operator, right, message) {
      const valid = operator === "==" ? left == right : operator === "===" ? left === right : operator === "!=" ? left != right : operator === "!==" ? left !== right : operator === ">" ? left > right : operator === ">=" ? left >= right : operator === "<" ? left < right : operator === "<=" ? left <= right : false;
      assertCondition(valid, message || `Expected ${left} ${operator} ${right}`);
    },
    closeTo(actual, expected, delta, message) {
      assertCondition(Math.abs(actual - expected) <= delta, message || `Expected ${actual} to be within ${delta} of ${expected}`);
    },
    approximately(actual, expected, delta, message) {
      assertCondition(Math.abs(actual - expected) <= delta, message || `Expected ${actual} to approximate ${expected}`);
    },
    isAbove(actual, expected, message) {
      assertCondition(actual > expected, message || `Expected ${actual} to be above ${expected}`);
    },
    isAtLeast(actual, expected, message) {
      assertCondition(actual >= expected, message || `Expected ${actual} to be at least ${expected}`);
    },
    isBelow(actual, expected, message) {
      assertCondition(actual < expected, message || `Expected ${actual} to be below ${expected}`);
    },
    isAtMost(actual, expected, message) {
      assertCondition(actual <= expected, message || `Expected ${actual} to be at most ${expected}`);
    },
    isWithin(actual, start, finish, message) {
      assertCondition(actual >= start && actual <= finish, message || `Expected ${actual} to be within ${start}..${finish}`);
    },
    oneOf(value, list, message) {
      assertCondition(list.includes(value), message || "Expected value to be one of the list");
    },
    sameMembers(actual, expected, message) {
      assertCondition(actual.length === expected.length && memberSubset(actual, expected), message || "Expected arrays to have the same members");
    },
    notSameMembers(actual, expected, message) {
      assertCondition(!(actual.length === expected.length && memberSubset(actual, expected)), message || "Expected arrays not to have the same members");
    },
    sameDeepMembers(actual, expected, message) {
      assertCondition(actual.length === expected.length && memberSubset(actual, expected, true), message || "Expected arrays to have the same deep members");
    },
    notSameDeepMembers(actual, expected, message) {
      assertCondition(!(actual.length === expected.length && memberSubset(actual, expected, true)), message || "Expected arrays not to have the same deep members");
    },
    includeMembers(actual, expected, message) {
      assertCondition(memberSubset(actual, expected), message || "Expected array to include members");
    },
    notIncludeMembers(actual, expected, message) {
      assertCondition(!memberSubset(actual, expected), message || "Expected array not to include all members");
    },
    includeDeepMembers(actual, expected, message) {
      assertCondition(memberSubset(actual, expected, true), message || "Expected array to deeply include members");
    },
    notIncludeDeepMembers(actual, expected, message) {
      assertCondition(!memberSubset(actual, expected, true), message || "Expected array not to deeply include all members");
    },
    sameOrderedMembers(actual, expected, message) {
      assertCondition(same(actual, expected), message || "Expected arrays to have ordered members");
    },
    notSameOrderedMembers(actual, expected, message) {
      assertCondition(!same(actual, expected), message || "Expected arrays not to have ordered members");
    },
    sameDeepOrderedMembers(actual, expected, message) {
      assertCondition(same(actual, expected), message || "Expected arrays to have deep ordered members");
    },
    notSameDeepOrderedMembers(actual, expected, message) {
      assertCondition(!same(actual, expected), message || "Expected arrays not to have deep ordered members");
    },
    includeOrderedMembers(actual, expected, message) {
      assertCondition(same(actual.slice(0, expected.length), expected), message || "Expected array to include ordered members");
    },
    notIncludeOrderedMembers(actual, expected, message) {
      assertCondition(!same(actual.slice(0, expected.length), expected), message || "Expected array not to include ordered members");
    },
    includeDeepOrderedMembers(actual, expected, message) {
      assertCondition(same(actual.slice(0, expected.length), expected), message || "Expected array to include deep ordered members");
    },
    notIncludeDeepOrderedMembers(actual, expected, message) {
      assertCondition(!same(actual.slice(0, expected.length), expected), message || "Expected array not to include deep ordered members");
    },
    changes(modifier2, target, propertyOrMessage, message) {
      const property = mutationProperty(target, propertyOrMessage);
      const measured = measureMutation(modifier2, target, property);
      assertCondition(!same(measured.before, measured.after), mutationMessage(target, propertyOrMessage, message) || "Expected value to change");
    },
    changesBy(modifier2, target, propertyOrDelta, deltaOrMessage, message) {
      const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage);
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrDelta)) === delta, deltaMessage(target, deltaOrMessage, message) || `Expected value to change by ${delta}`);
    },
    doesNotChange(modifier2, target, propertyOrMessage, message) {
      const property = mutationProperty(target, propertyOrMessage);
      const measured = measureMutation(modifier2, target, property);
      assertCondition(same(measured.before, measured.after), mutationMessage(target, propertyOrMessage, message) || "Expected value not to change");
    },
    changesButNotBy(modifier2, target, propertyOrDelta, deltaOrMessage, message) {
      const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage);
      const change = measureChange(modifier2, target, mutationProperty(target, propertyOrDelta));
      assertCondition(change !== 0 && change !== delta, deltaMessage(target, deltaOrMessage, message) || `Expected value to change but not by ${delta}`);
    },
    increases(modifier2, target, propertyOrMessage, message) {
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrMessage)) > 0, mutationMessage(target, propertyOrMessage, message) || "Expected value to increase");
    },
    increasesBy(modifier2, target, propertyOrDelta, deltaOrMessage, message) {
      const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage);
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrDelta)) === delta && delta > 0, deltaMessage(target, deltaOrMessage, message) || `Expected value to increase by ${delta}`);
    },
    doesNotIncrease(modifier2, target, propertyOrMessage, message) {
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrMessage)) <= 0, mutationMessage(target, propertyOrMessage, message) || "Expected value not to increase");
    },
    increasesButNotBy(modifier2, target, propertyOrDelta, deltaOrMessage, message) {
      const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage);
      const change = measureChange(modifier2, target, mutationProperty(target, propertyOrDelta));
      assertCondition(change > 0 && change !== delta, deltaMessage(target, deltaOrMessage, message) || `Expected value to increase but not by ${delta}`);
    },
    decreases(modifier2, target, propertyOrMessage, message) {
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrMessage)) < 0, mutationMessage(target, propertyOrMessage, message) || "Expected value to decrease");
    },
    decreasesBy(modifier2, target, propertyOrDelta, deltaOrMessage, message) {
      const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage);
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrDelta)) === -Math.abs(delta), deltaMessage(target, deltaOrMessage, message) || `Expected value to decrease by ${delta}`);
    },
    doesNotDecrease(modifier2, target, propertyOrMessage, message) {
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrMessage)) >= 0, mutationMessage(target, propertyOrMessage, message) || "Expected value not to decrease");
    },
    doesNotDecreaseBy(modifier2, target, propertyOrDelta, deltaOrMessage, message) {
      const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage);
      assertCondition(measureChange(modifier2, target, mutationProperty(target, propertyOrDelta)) !== -Math.abs(delta), deltaMessage(target, deltaOrMessage, message) || `Expected value not to decrease by ${delta}`);
    },
    decreasesButNotBy(modifier2, target, propertyOrDelta, deltaOrMessage, message) {
      const delta = mutationDelta(target, propertyOrDelta, deltaOrMessage);
      const change = measureChange(modifier2, target, mutationProperty(target, propertyOrDelta));
      assertCondition(change < 0 && change !== -Math.abs(delta), deltaMessage(target, deltaOrMessage, message) || `Expected value to decrease but not by ${delta}`);
    },
    throws(callback, errorLike, matcher, message) {
      try {
        callback();
      } catch (error) {
        const typeMatches = !errorLike || errorLike instanceof RegExp || typeof errorLike === "string" || typeof errorLike === "function" && error instanceof errorLike || error === errorLike;
        const expectedMessage = errorLike instanceof RegExp || typeof errorLike === "string" ? errorLike : matcher;
        const messageMatches = !expectedMessage || (expectedMessage instanceof RegExp ? expectedMessage.test(String(error.message ?? error)) : String(error.message ?? error).includes(expectedMessage));
        assertCondition(typeMatches && messageMatches, message || "Thrown error did not match expectation");
        return error;
      }
      throw new Error(message || "Expected function to throw");
    },
    doesNotThrow(callback, message) {
      try {
        callback();
      } catch (error) {
        throw new Error(message || `Expected function not to throw: ${error}`);
      }
    },
    respondTo(value, method, message) {
      const target = typeof value === "function" ? value.prototype : value;
      assertCondition(typeof target?.[method] === "function", message || `Expected value to respond to '${method}'`);
    },
    notRespondTo(value, method, message) {
      const target = typeof value === "function" ? value.prototype : value;
      assertCondition(typeof target?.[method] !== "function", message || `Expected value not to respond to '${method}'`);
    },
    satisfies(value, predicate, message) {
      assertCondition(Boolean(predicate(value)), message || "Expected value to satisfy predicate");
    },
    ifError(value) {
      if (value) throw value;
    },
    isExtensible(value, message) {
      assertCondition(Object.isExtensible(value), message || "Expected object to be extensible");
    },
    isNotExtensible(value, message) {
      assertCondition(!Object.isExtensible(value), message || "Expected object not to be extensible");
    },
    isSealed(value, message) {
      assertCondition(Object.isSealed(value), message || "Expected object to be sealed");
    },
    isNotSealed(value, message) {
      assertCondition(!Object.isSealed(value), message || "Expected object not to be sealed");
    },
    isFrozen(value, message) {
      assertCondition(Object.isFrozen(value), message || "Expected object to be frozen");
    },
    isNotFrozen(value, message) {
      assertCondition(!Object.isFrozen(value), message || "Expected object not to be frozen");
    },
    isEmpty(value, message) {
      assertCondition((lengthOrSize(value) ?? (value && typeof value === "object" ? Object.keys(value).length : void 0)) === 0, message || "Expected value to be empty");
    },
    isNotEmpty(value, message) {
      assertCondition((lengthOrSize(value) ?? (value && typeof value === "object" ? Object.keys(value).length : void 0)) !== 0, message || "Expected value not to be empty");
    }
  });
  const pathParts = (path) => Array.isArray(path) ? path.map(String) : String(path).replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
  const lodash = {};
  const lodashGet = (value, path, fallback) => pathParts(path).reduce((current, key) => current?.[key], value) ?? fallback;
  const lodashSet = (value, path, next) => {
    const parts = pathParts(path);
    let current = value;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) current[part] = next;
      else current = current[part] && typeof current[part] === "object" ? current[part] : current[part] = {};
    });
    return value;
  };
  const deepMerge = (target, source) => {
    Object.entries(source).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) target[key] = deepMerge(target[key] && typeof target[key] === "object" && !Array.isArray(target[key]) ? target[key] : {}, value);
      else target[key] = runtime.structuredClone(value);
    });
    return target;
  };
  const words = (value) => String(value).trim().replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean).map((word) => word.toLowerCase());
  Object.assign(lodash, {
    clone: (value) => Array.isArray(value) ? [...value] : value && typeof value === "object" ? { ...value } : value,
    cloneDeep: runtime.structuredClone,
    get: lodashGet,
    set: lodashSet,
    has: (value, path) => lodashGet(value, path, void 0) !== void 0,
    merge: (target, ...sources) => sources.reduce(deepMerge, target),
    isEqual: same,
    isEmpty: (value) => value == null || (typeof value === "string" || Array.isArray(value) ? value.length === 0 : typeof value === "object" ? Object.keys(value).length === 0 : true),
    isArray: Array.isArray,
    isObject: (value) => value !== null && typeof value === "object",
    map: (value, callback) => Array.isArray(value) ? value.map(callback) : Object.entries(value ?? {}).map(([key, item]) => callback(item, key)),
    filter: (value, callback) => Array.from(value ?? []).filter(callback),
    find: (value, callback) => Array.from(value ?? []).find(callback),
    reduce: (value, callback, initial) => Array.from(value ?? []).reduce(callback, initial),
    each: (value, callback) => {
      (Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value ?? {})).forEach(([key, item]) => callback(item, key));
      return value;
    },
    forEach: (value, callback) => {
      (Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value ?? {})).forEach(([key, item]) => callback(item, key));
      return value;
    },
    keys: (value) => Object.keys(value ?? {}),
    values: (value) => Object.values(value ?? {}),
    pick: (value, names) => Object.fromEntries(names.filter((name) => Object.prototype.hasOwnProperty.call(value, name)).map((name) => [name, value[name]])),
    omit: (value, names) => Object.fromEntries(Object.entries(value).filter(([name]) => !names.includes(name))),
    groupBy: (value, callback) => Array.from(value ?? []).reduce((groups, item) => {
      const key = String(typeof callback === "function" ? callback(item) : lodashGet(item, callback));
      (groups[key] ??= []).push(item);
      return groups;
    }, {}),
    uniq: (value) => [...new Set(value)],
    uniqBy: (value, callback) => {
      const seen = /* @__PURE__ */ new Set();
      return Array.from(value ?? []).filter((item) => {
        const key = typeof callback === "function" ? callback(item) : lodashGet(item, callback);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    flatten: (value) => Array.from(value ?? []).flat(),
    flattenDeep: (value) => Array.from(value ?? []).flat(Infinity),
    sortBy: (value, callback) => [...value].sort((left, right) => {
      const a = typeof callback === "function" ? callback(left) : lodashGet(left, callback);
      const b = typeof callback === "function" ? callback(right) : lodashGet(right, callback);
      return a < b ? -1 : a > b ? 1 : 0;
    }),
    camelCase: (value) => words(value).map((word, index) => index ? word[0].toUpperCase() + word.slice(1) : word).join(""),
    kebabCase: (value) => words(value).join("-"),
    snakeCase: (value) => words(value).join("_"),
    startCase: (value) => words(value).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")
  });
  const querystring = {
    escape: encodeURIComponent,
    unescape: decodeURIComponent,
    parse(value, separator = "&", equals = "=") {
      const output = {};
      boundedText(value).split(separator).filter(Boolean).slice(0, 1e4).forEach((part) => {
        const index = part.indexOf(equals);
        const key = decodeURIComponent((index < 0 ? part : part.slice(0, index)).replace(/\+/g, " "));
        const item = decodeURIComponent((index < 0 ? "" : part.slice(index + equals.length)).replace(/\+/g, " "));
        output[key] = output[key] === void 0 ? item : Array.isArray(output[key]) ? [...output[key], item] : [output[key], item];
      });
      return output;
    },
    stringify(value, separator = "&", equals = "=") {
      return Object.entries(value ?? {}).flatMap(([key, item]) => (Array.isArray(item) ? item : [item]).map((entry) => `${encodeURIComponent(key)}${equals}${encodeURIComponent(String(entry ?? ""))}`)).join(separator);
    }
  };
  const parseCsv = (input, options = {}) => {
    const text2 = boundedText(input);
    const delimiter = String(options.delimiter ?? ",");
    const records = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text2.length; index += 1) {
      const character = text2[index];
      if (character === '"' && quoted && text2[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = !quoted;
      else if (!quoted && text2.startsWith(delimiter, index)) {
        row.push(options.trim ? value.trim() : value);
        value = "";
        index += delimiter.length - 1;
      } else if (!quoted && (character === "\n" || character === "\r")) {
        if (character === "\r" && text2[index + 1] === "\n") index += 1;
        row.push(options.trim ? value.trim() : value);
        value = "";
        if (!(options.skip_empty_lines && row.every((item) => !item))) records.push(row);
        row = [];
        if (records.length > 1e5) throw new Error("CSV input exceeds 100,000 records.");
      } else value += character;
    }
    if (quoted) throw new Error("CSV input has an unterminated quoted field.");
    if (value || row.length) {
      row.push(options.trim ? value.trim() : value);
      if (!(options.skip_empty_lines && row.every((item) => !item))) records.push(row);
    }
    if (options.columns) {
      const headers = Array.isArray(options.columns) ? options.columns.map(String) : records.shift() ?? [];
      return records.map((record5) => Object.fromEntries(headers.map((header, index) => [header, record5[index] ?? ""])));
    }
    return records;
  };
  const csvParse = Object.assign((input, options, callback) => {
    const done = typeof options === "function" ? options : callback;
    try {
      const result = parseCsv(input, typeof options === "object" ? options : {});
      if (done) {
        runtime.setTimeout(() => done(void 0, result), 0);
        return void 0;
      }
      return result;
    } catch (error) {
      if (done) {
        runtime.setTimeout(() => done(error instanceof Error ? error : new Error(String(error))), 0);
        return void 0;
      }
      throw error;
    }
  }, { parse: parseCsv, sync: parseCsv });
  const validateSchema = (schema, data, schemas, path = "", depth = 0) => {
    if (depth > 100) return [{ instancePath: path, message: "schema nesting exceeds 100 levels" }];
    if (typeof schema === "boolean") return schema ? [] : [{ instancePath: path, message: "boolean schema rejected value" }];
    if (!schema || typeof schema !== "object") return [];
    const source = schema;
    if (typeof source.$ref === "string") {
      if (source.$ref.startsWith("#/")) return [{ instancePath: path, message: "local $ref requires compilation through a root schema" }];
      const referenced = schemas.get(source.$ref);
      return referenced ? validateSchema(referenced, data, schemas, path, depth + 1) : [{ instancePath: path, message: `unresolved reference ${source.$ref}` }];
    }
    const errors = [];
    const types = Array.isArray(source.type) ? source.type : source.type ? [source.type] : [];
    const matchesType = (type) => type === "null" ? data === null : type === "array" ? Array.isArray(data) : type === "integer" ? Number.isInteger(data) : type === "number" ? typeof data === "number" && Number.isFinite(data) : type === "object" ? Boolean(data) && typeof data === "object" && !Array.isArray(data) : typeof data === type;
    if (types.length && !types.some(matchesType)) errors.push({ instancePath: path, message: `must be ${types.join(" or ")}` });
    if (source.const !== void 0 && !same(data, source.const)) errors.push({ instancePath: path, message: "must equal constant" });
    if (Array.isArray(source.enum) && !source.enum.some((value) => same(value, data))) errors.push({ instancePath: path, message: "must be equal to one of the allowed values" });
    if (typeof data === "string") {
      if (typeof source.minLength === "number" && data.length < source.minLength) errors.push({ instancePath: path, message: `must NOT have fewer than ${source.minLength} characters` });
      if (typeof source.maxLength === "number" && data.length > source.maxLength) errors.push({ instancePath: path, message: `must NOT have more than ${source.maxLength} characters` });
      if (typeof source.pattern === "string" && !new RegExp(source.pattern).test(data)) errors.push({ instancePath: path, message: `must match pattern ${source.pattern}` });
      if (source.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) errors.push({ instancePath: path, message: "must match format email" });
      if (source.format === "uri" || source.format === "url") {
        try {
          new runtime.URL(data);
        } catch {
          errors.push({ instancePath: path, message: `must match format ${source.format}` });
        }
      }
    }
    if (typeof data === "number") {
      if (typeof source.minimum === "number" && data < source.minimum) errors.push({ instancePath: path, message: `must be >= ${source.minimum}` });
      if (typeof source.maximum === "number" && data > source.maximum) errors.push({ instancePath: path, message: `must be <= ${source.maximum}` });
    }
    if (Array.isArray(data)) {
      if (typeof source.minItems === "number" && data.length < source.minItems) errors.push({ instancePath: path, message: `must NOT have fewer than ${source.minItems} items` });
      if (typeof source.maxItems === "number" && data.length > source.maxItems) errors.push({ instancePath: path, message: `must NOT have more than ${source.maxItems} items` });
      if (source.uniqueItems && new Set(data.map((item) => JSON.stringify(item))).size !== data.length) errors.push({ instancePath: path, message: "must NOT have duplicate items" });
      if (source.items !== void 0) data.forEach((item, index) => errors.push(...validateSchema(source.items, item, schemas, `${path}/${index}`, depth + 1)));
    }
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const object = data;
      const required = Array.isArray(source.required) ? source.required.map(String) : [];
      required.filter((name) => !Object.prototype.hasOwnProperty.call(object, name)).forEach((name) => errors.push({ instancePath: path, message: `must have required property '${name}'` }));
      const properties = source.properties && typeof source.properties === "object" ? source.properties : {};
      Object.entries(properties).filter(([name]) => Object.prototype.hasOwnProperty.call(object, name)).forEach(([name, child]) => errors.push(...validateSchema(child, object[name], schemas, `${path}/${name}`, depth + 1)));
      if (source.additionalProperties === false) Object.keys(object).filter((name) => !Object.prototype.hasOwnProperty.call(properties, name)).forEach((name) => errors.push({ instancePath: `${path}/${name}`, message: "must NOT have additional properties" }));
    }
    if (Array.isArray(source.allOf)) source.allOf.forEach((item) => errors.push(...validateSchema(item, data, schemas, path, depth + 1)));
    if (Array.isArray(source.anyOf) && !source.anyOf.some((item) => validateSchema(item, data, schemas, path, depth + 1).length === 0)) errors.push({ instancePath: path, message: "must match a schema in anyOf" });
    if (Array.isArray(source.oneOf) && source.oneOf.filter((item) => validateSchema(item, data, schemas, path, depth + 1).length === 0).length !== 1) errors.push({ instancePath: path, message: "must match exactly one schema in oneOf" });
    if (source.not && validateSchema(source.not, data, schemas, path, depth + 1).length === 0) errors.push({ instancePath: path, message: "must NOT be valid" });
    return errors.slice(0, 1e3);
  };
  class Ajv {
    schemas = /* @__PURE__ */ new Map();
    errors = null;
    constructor(options) {
      void options;
    }
    addSchema(schema, key) {
      const id = key ?? schema?.$id;
      if (id) this.schemas.set(String(id), schema);
      return this;
    }
    getSchema(key) {
      const schema = this.schemas.get(key);
      return schema === void 0 ? void 0 : this.compile(schema);
    }
    compile(schema) {
      const validate = ((data) => {
        const errors = validateSchema(schema, data, this.schemas);
        validate.errors = errors.length ? errors : null;
        this.errors = validate.errors;
        return errors.length === 0;
      });
      validate.errors = null;
      return validate;
    }
    validate(schema, data) {
      const candidate = typeof schema === "string" ? this.schemas.get(schema) : schema;
      if (candidate === void 0) throw new Error(`Unknown schema '${schema}'`);
      return this.compile(candidate)(data);
    }
  }
  Object.assign(Ajv, { default: Ajv });
  const tv4Schemas = /* @__PURE__ */ new Map();
  const tv4 = {
    error: null,
    addSchema(key, schema) {
      if (typeof key === "string") tv4Schemas.set(key, schema);
      else if (key.id || key.$id) tv4Schemas.set(String(key.id ?? key.$id), key);
      return tv4;
    },
    getSchema: (key) => tv4Schemas.get(key),
    validate(data, schema) {
      const errors = validateSchema(schema, data, tv4Schemas);
      tv4.error = errors[0] ?? null;
      return errors.length === 0;
    },
    validateResult(data, schema) {
      const errors = validateSchema(schema, data, tv4Schemas);
      return { valid: errors.length === 0, error: errors[0] ?? null, missing: [] };
    },
    validateMultiple(data, schema) {
      const errors = validateSchema(schema, data, tv4Schemas);
      return { valid: errors.length === 0, errors, missing: [] };
    },
    reset() {
      tv4Schemas.clear();
      tv4.error = null;
    }
  };
  const bytesToHex = (bytes) => [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  const hexToBytes = (hex) => new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((value) => parseInt(value, 16)));
  const bytesToBase64 = (bytes) => runtime.btoa([...bytes].map((value) => String.fromCharCode(value)).join(""));
  const base64ToBytes = (value) => new Uint8Array([...runtime.atob(value)].map((character) => character.charCodeAt(0)));
  const wordArray = (bytes) => ({ sigBytes: bytes.length, words: Array.from({ length: Math.ceil(bytes.length / 4) }, (_, index) => (bytes[index * 4] ?? 0) << 24 | (bytes[index * 4 + 1] ?? 0) << 16 | (bytes[index * 4 + 2] ?? 0) << 8 | (bytes[index * 4 + 3] ?? 0)), bytes, toString(encoder) {
    return (encoder ?? cryptoEnc.Hex).stringify(this);
  } });
  const inputBytes = (value) => value && typeof value === "object" && "bytes" in value ? value.bytes : new runtime.TextEncoder().encode(boundedText(value));
  const sha256Hex = (input) => {
    const bytes = inputBytes(input);
    const k = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);
    const length = bytes.length;
    const paddedLength = Math.ceil((length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[length] = 128;
    const bits = length * 8;
    for (let index = 0; index < 8; index += 1) padded[paddedLength - 1 - index] = Math.floor(bits / 2 ** (index * 8)) & 255;
    const hash = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
    const rotate = (value, amount) => value >>> amount | value << 32 - amount;
    for (let offset = 0; offset < padded.length; offset += 64) {
      const w = new Uint32Array(64);
      for (let index = 0; index < 16; index += 1) w[index] = padded[offset + index * 4] << 24 | padded[offset + index * 4 + 1] << 16 | padded[offset + index * 4 + 2] << 8 | padded[offset + index * 4 + 3];
      for (let index = 16; index < 64; index += 1) {
        const a2 = rotate(w[index - 15], 7) ^ rotate(w[index - 15], 18) ^ w[index - 15] >>> 3;
        const b2 = rotate(w[index - 2], 17) ^ rotate(w[index - 2], 19) ^ w[index - 2] >>> 10;
        w[index] = w[index - 16] + a2 + w[index - 7] + b2 >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const choice = e & f ^ ~e & g;
        const t1 = h + s1 + choice + k[index] + w[index] >>> 0;
        const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const majority = a & b ^ a & c ^ b & c;
        const t2 = s0 + majority >>> 0;
        h = g;
        g = f;
        f = e;
        e = d + t1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((value, index) => {
        hash[index] = hash[index] + value >>> 0;
      });
    }
    return [...hash].map((value) => value.toString(16).padStart(8, "0")).join("");
  };
  const cryptoEnc = {
    Hex: { stringify: (value) => bytesToHex(value.bytes), parse: (value) => wordArray(hexToBytes(value)) },
    Utf8: { stringify: (value) => new runtime.TextDecoder().decode(value.bytes), parse: (value) => wordArray(new runtime.TextEncoder().encode(boundedText(value))) },
    Base64: { stringify: (value) => bytesToBase64(value.bytes), parse: (value) => wordArray(base64ToBytes(value)) }
  };
  const cryptoJs = {
    enc: cryptoEnc,
    lib: { WordArray: { create: (wordsOrBytes, sigBytes) => {
      if (wordsOrBytes instanceof Uint8Array) return wordArray(wordsOrBytes.slice(0, sigBytes));
      const values = wordsOrBytes ?? [];
      const bytes = new Uint8Array(sigBytes ?? values.length * 4);
      values.forEach((word, index) => {
        bytes[index * 4] = word >>> 24;
        bytes[index * 4 + 1] = word >>> 16;
        bytes[index * 4 + 2] = word >>> 8;
        bytes[index * 4 + 3] = word;
      });
      return wordArray(bytes);
    }, random: (length) => wordArray(runtime.crypto.getRandomValues(new Uint8Array(Math.min(1e6, Math.max(0, length))))) } },
    SHA256: (value) => wordArray(hexToBytes(sha256Hex(value)))
  };
  const parseMarkup = (input) => {
    const root = { type: "root", name: "root", attrs: {}, children: [] };
    const stack = [root];
    const tokens = boundedText(input).match(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g) ?? [];
    tokens.slice(0, 1e5).forEach((token) => {
      if (token.startsWith("<!--")) return;
      if (token.startsWith("</")) {
        if (stack.length > 1) stack.pop();
        return;
      }
      if (token.startsWith("<")) {
        const match = token.match(/^<\s*([^\s/>]+)([\s\S]*?)\/?\s*>$/);
        if (!match) return;
        const node = { type: "tag", name: match[1].toLowerCase(), attrs: {}, children: [], parent: stack.at(-1) };
        match[2].replace(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, (_all, name, quoted, single, plain) => {
          node.attrs[String(name).toLowerCase()] = String(quoted ?? single ?? plain ?? "");
          return "";
        });
        stack.at(-1).children.push(node);
        if (!token.endsWith("/>") && !/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(node.name)) stack.push(node);
      } else if (token) stack.at(-1).children.push({ type: "text", name: "#text", attrs: {}, children: [], parent: stack.at(-1), text: token });
    });
    return root;
  };
  const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
  const nodeText = (node) => node.type === "text" ? node.text ?? "" : node.children.map(nodeText).join("");
  const serializeNode = (node) => node.type === "text" ? node.text ?? "" : node.type === "root" ? node.children.map(serializeNode).join("") : `<${node.name}${Object.entries(node.attrs).map(([name, value]) => ` ${name}="${value}"`).join("")}>${node.children.map(serializeNode).join("")}</${node.name}>`;
  const matchesSelector = (node, selector) => {
    if (node.type !== "tag") return false;
    const attr = selector.match(/\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]/);
    if (attr && (!(attr[1].toLowerCase() in node.attrs) || attr[2] !== void 0 && node.attrs[attr[1].toLowerCase()] !== attr[2])) return false;
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && node.attrs.id !== id) return false;
    const classes = [...selector.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);
    const classNames = (node.attrs.class ?? "").split(/\s+/);
    if (classes.some((name) => !classNames.includes(name))) return false;
    const tag = selector.match(/^([A-Za-z][\w-]*)/)?.[1];
    return !tag || node.name === tag.toLowerCase();
  };
  const queryNodes = (root, selector) => selector.split(",").flatMap((group) => {
    const chain = group.trim().split(/\s+/);
    return descendants(root).filter((node) => {
      if (!matchesSelector(node, chain.at(-1))) return false;
      let ancestor = node.parent;
      for (let index = chain.length - 2; index >= 0; index -= 1) {
        while (ancestor && !matchesSelector(ancestor, chain[index])) ancestor = ancestor.parent;
        if (!ancestor) return false;
        ancestor = ancestor.parent;
      }
      return true;
    });
  });
  const cheerioLoad = (input) => {
    const root = parseMarkup(input);
    const wrap = (nodes) => {
      const selection = {
        length: nodes.length,
        get: (index) => index === void 0 ? nodes : nodes[index < 0 ? nodes.length + index : index],
        toArray: () => [...nodes],
        first: () => wrap(nodes.slice(0, 1)),
        last: () => wrap(nodes.slice(-1)),
        eq: (index) => wrap(nodes.slice(index < 0 ? nodes.length + index : index, (index < 0 ? nodes.length + index : index) + 1)),
        text: (value) => {
          if (value === void 0) return nodes.map(nodeText).join("");
          nodes.forEach((node) => {
            node.children = [{ type: "text", name: "#text", attrs: {}, children: [], parent: node, text: String(value) }];
          });
          return selection;
        },
        html: (value) => {
          if (value === void 0) return nodes[0]?.children.map(serializeNode).join("") ?? null;
          nodes.forEach((node) => {
            const parsed = parseMarkup(value);
            node.children = parsed.children.map((child) => ({ ...child, parent: node }));
          });
          return selection;
        },
        attr: (name, value) => {
          if (value === void 0) return nodes[0]?.attrs[name.toLowerCase()];
          nodes.forEach((node) => {
            node.attrs[name.toLowerCase()] = String(value);
          });
          return selection;
        },
        find: (selector) => wrap(nodes.flatMap((node) => queryNodes(node, selector))),
        each: (callback) => {
          nodes.forEach((node, index) => callback(index, node));
          return selection;
        },
        map: (callback) => {
          const values = nodes.map((node, index) => callback(index, node));
          return { get: () => values, toArray: () => values };
        }
      };
      nodes.forEach((node, index) => {
        selection[index] = node;
      });
      return selection;
    };
    const select = ((selectorOrNode) => typeof selectorOrNode === "string" ? wrap(queryNodes(root, selectorOrNode)) : wrap([selectorOrNode]));
    select.root = () => wrap([root]);
    select.html = () => serializeNode(root);
    select.text = () => nodeText(root);
    return select;
  };
  const cheerio = { load: cheerioLoad };
  const xmlNodeObject = (node, options) => {
    const children = node.children.filter((child) => child.type === "tag");
    const text2 = node.children.filter((child) => child.type === "text").map(nodeText).join("").trim();
    if (!children.length && !Object.keys(node.attrs).length) return text2;
    const output = {};
    if (Object.keys(node.attrs).length) output[String(options.attrkey ?? "$")] = { ...node.attrs };
    if (text2) output[String(options.charkey ?? "_")] = text2;
    children.forEach((child) => {
      const value = xmlNodeObject(child, options);
      const key = child.name;
      if (output[key] === void 0) output[key] = options.explicitArray === false ? value : [value];
      else if (Array.isArray(output[key])) output[key].push(value);
      else output[key] = [output[key], value];
    });
    return output;
  };
  const parseXml = (input, options = {}) => {
    const root = parseMarkup(input);
    const first = root.children.find((child) => child.type === "tag");
    if (!first) throw new Error("XML contains no root element.");
    return { [first.name]: xmlNodeObject(first, options) };
  };
  class XmlParser {
    constructor(options = {}) {
      this.options = options;
    }
    options;
    parseString(input, callback) {
      try {
        callback(null, parseXml(input, this.options));
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
      }
    }
    parseStringPromise(input) {
      return Promise.resolve(parseXml(input, this.options));
    }
  }
  class XmlBuilder {
    constructor(options = {}) {
      this.options = options;
    }
    options;
    buildObject(value) {
      void this.options;
      const build = (name2, item2) => {
        if (Array.isArray(item2)) return item2.map((entry) => build(name2, entry)).join("");
        if (item2 && typeof item2 === "object") {
          const object = item2;
          const attrs = object.$ && typeof object.$ === "object" ? Object.entries(object.$).map(([key, entry]) => ` ${key}="${String(entry)}"`).join("") : "";
          return `<${name2}${attrs}>${object._ ?? ""}${Object.entries(object).filter(([key]) => key !== "$" && key !== "_").map(([key, entry]) => build(key, entry)).join("")}</${name2}>`;
        }
        return `<${name2}>${String(item2 ?? "")}</${name2}>`;
      };
      const [name, item] = Object.entries(value)[0] ?? ["root", ""];
      return build(name, item);
    }
  }
  const xml2js = { Parser: XmlParser, Builder: XmlBuilder, parseString: (input, options, callback) => {
    const done = typeof options === "function" ? options : callback;
    return new XmlParser(typeof options === "object" ? options : {}).parseString(input, done ?? (() => void 0));
  }, parseStringPromise: (input, options) => Promise.resolve(parseXml(input, options)), processors: {} };
  const momentFormat = (date, pattern = "YYYY-MM-DDTHH:mm:ssZ", utc = false) => {
    const get = (name) => date[`get${utc ? "UTC" : ""}${name}`]();
    const offset = utc ? 0 : -date.getTimezoneOffset();
    const zone = offset === 0 ? "+00:00" : `${offset < 0 ? "-" : "+"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
    return pattern.replace(/YYYY|MM|DD|HH|mm|ss|SSS|X|x|Z/g, (token) => ({ YYYY: String(get("FullYear")), MM: String(get("Month") + 1).padStart(2, "0"), DD: String(get("Date")).padStart(2, "0"), HH: String(get("Hours")).padStart(2, "0"), mm: String(get("Minutes")).padStart(2, "0"), ss: String(get("Seconds")).padStart(2, "0"), SSS: String(get("Milliseconds")).padStart(3, "0"), X: String(Math.floor(date.getTime() / 1e3)), x: String(date.getTime()), Z: zone })[token]);
  };
  const moment = ((input) => {
    const date = input && typeof input === "object" && "_date" in input ? new Date(input._date) : input === void 0 ? /* @__PURE__ */ new Date() : new Date(input);
    let utc = false;
    const api = { _date: date };
    const unitMs = (unit) => /^s/.test(String(unit)) ? 1e3 : /^m(?!o)/.test(String(unit)) ? 6e4 : /^h/.test(String(unit)) ? 36e5 : /^d/.test(String(unit)) ? 864e5 : /^w/.test(String(unit)) ? 6048e5 : 0;
    Object.assign(api, { isValid: () => !Number.isNaN(date.getTime()), toDate: () => new Date(date), toISOString: () => date.toISOString(), valueOf: () => date.getTime(), unix: () => Math.floor(date.getTime() / 1e3), format: (pattern) => momentFormat(date, pattern, utc), clone: () => moment(api), utc: () => {
      utc = true;
      return api;
    }, local: () => {
      utc = false;
      return api;
    }, add: (amount, unit) => {
      if (/^mo/.test(unit)) date.setMonth(date.getMonth() + amount);
      else if (/^y/.test(unit)) date.setFullYear(date.getFullYear() + amount);
      else date.setTime(date.getTime() + amount * unitMs(unit));
      return api;
    }, subtract: (amount, unit) => {
      api.add(-amount, unit);
      return api;
    }, diff: (other, unit = "milliseconds") => {
      const difference = date.getTime() - moment(other).valueOf();
      const divisor = unitMs(unit) || 1;
      return Math.trunc(difference / divisor);
    } });
    return api;
  });
  moment.utc = (input) => moment(input).utc();
  moment.unix = (value) => moment(value * 1e3);
  moment.isMoment = (value) => Boolean(value && typeof value === "object" && "_date" in value);
  moment.duration = (value, unit = "milliseconds") => ({ asMilliseconds: () => value * (/^s/.test(unit) ? 1e3 : /^m/.test(unit) ? 6e4 : /^h/.test(unit) ? 36e5 : /^d/.test(unit) ? 864e5 : 1), humanize: () => `${value} ${unit}` });
  class PropertyList {
    members;
    constructor(_parent, initial = []) {
      this.members = Array.isArray(initial) ? initial.map((item) => item) : [];
    }
    add(item) {
      this.members.push(item);
      return item;
    }
    get(id) {
      return this.members.find((item) => item.id === id || item.key === id || item.name === id);
    }
    remove(id) {
      const index = this.members.findIndex((item) => item.id === id || item.key === id || item.name === id);
      return index < 0 ? void 0 : this.members.splice(index, 1)[0];
    }
    all() {
      return [...this.members];
    }
    each(callback) {
      this.members.forEach(callback);
    }
    toJSON() {
      return this.members.map((item) => typeof item.toJSON === "function" ? item.toJSON() : item);
    }
    get count() {
      return this.members.length;
    }
  }
  class Variable {
    id;
    key;
    value;
    type;
    constructor(input = {}) {
      this.id = String(input.id ?? runtime.crypto.randomUUID());
      this.key = String(input.key ?? input.name ?? "");
      this.value = input.value ?? "";
      this.type = String(input.type ?? "any");
    }
    toJSON() {
      return { id: this.id, key: this.key, value: this.value, type: this.type };
    }
  }
  class Header {
    id;
    key;
    value;
    disabled;
    constructor(input = {}) {
      const source = typeof input === "string" ? { key: input.split(":")[0], value: input.split(":").slice(1).join(":").trim() } : input;
      this.id = String(source.id ?? runtime.crypto.randomUUID());
      this.key = String(source.key ?? source.name ?? "");
      this.value = String(source.value ?? "");
      this.disabled = source.disabled === true;
    }
    toJSON() {
      return { key: this.key, value: this.value, disabled: this.disabled };
    }
  }
  class Url {
    raw;
    constructor(input = "") {
      this.raw = typeof input === "string" ? input : String(input?.raw ?? "");
    }
    toString() {
      return this.raw;
    }
    toJSON() {
      return this.raw;
    }
  }
  class RequestBody {
    mode;
    raw;
    constructor(input = {}) {
      this.mode = String(input.mode ?? "raw");
      this.raw = String(input.raw ?? "");
      Object.assign(this, input);
    }
    toJSON() {
      return { ...this };
    }
  }
  class Request {
    id;
    name;
    method;
    url;
    headers;
    body;
    constructor(input = {}) {
      this.id = String(input.id ?? runtime.crypto.randomUUID());
      this.name = String(input.name ?? "");
      this.method = String(input.method ?? "GET");
      this.url = new Url(input.url);
      this.headers = new PropertyList(this, (Array.isArray(input.header) ? input.header : Array.isArray(input.headers) ? input.headers : []).map((item) => new Header(item)));
      this.body = new RequestBody(input.body);
    }
    toJSON() {
      return { id: this.id, name: this.name, method: this.method, url: this.url.toJSON(), header: this.headers.toJSON(), body: this.body.toJSON() };
    }
  }
  class Response {
    id;
    name;
    code;
    status;
    body;
    headers;
    constructor(input = {}) {
      this.id = String(input.id ?? runtime.crypto.randomUUID());
      this.name = String(input.name ?? "");
      this.code = Number(input.code ?? 0);
      this.status = String(input.status ?? "");
      this.body = String(input.body ?? "");
      this.headers = new PropertyList(this, (Array.isArray(input.header) ? input.header : []).map((item) => new Header(item)));
    }
    toJSON() {
      return { id: this.id, name: this.name, code: this.code, status: this.status, body: this.body, header: this.headers.toJSON() };
    }
  }
  class Item {
    id;
    name;
    request;
    items;
    constructor(input = {}) {
      this.id = String(input.id ?? runtime.crypto.randomUUID());
      this.name = String(input.name ?? "");
      if (input.request) this.request = new Request(input.request);
      if (Array.isArray(input.item)) this.items = new PropertyList(this, input.item.map((item) => new Item(item)));
    }
    toJSON() {
      return { id: this.id, name: this.name, ...this.request ? { request: this.request.toJSON() } : {}, ...this.items ? { item: this.items.toJSON() } : {} };
    }
  }
  class Collection {
    id;
    name;
    items;
    variables;
    constructor(input = {}) {
      const info = input.info && typeof input.info === "object" ? input.info : {};
      this.id = String(info._postman_id ?? input.id ?? runtime.crypto.randomUUID());
      this.name = String(info.name ?? input.name ?? "");
      this.items = new PropertyList(this, (Array.isArray(input.item) ? input.item : []).map((item) => new Item(item)));
      this.variables = new PropertyList(this, (Array.isArray(input.variable) ? input.variable : []).map((item) => new Variable(item)));
    }
    toJSON() {
      return { info: { _postman_id: this.id, name: this.name }, item: this.items.toJSON(), variable: this.variables.toJSON() };
    }
  }
  const postmanCollection = { Collection, Item, ItemGroup: Item, Request, Response, Header, HeaderList: PropertyList, Variable, VariableList: PropertyList, PropertyList, Url, RequestBody };
  class BufferPolyfill extends Uint8Array {
    static from(value, encodingOrMap = "utf8", thisArg) {
      if (typeof value === "string") return new BufferPolyfill(encodingOrMap === "base64" ? base64ToBytes(value) : encodingOrMap === "hex" ? hexToBytes(value) : new runtime.TextEncoder().encode(value));
      if (value instanceof ArrayBuffer) return new BufferPolyfill(new Uint8Array(value));
      const values = Array.from(value, typeof encodingOrMap === "function" ? encodingOrMap : (item) => Number(item), thisArg);
      return new BufferPolyfill(values);
    }
    static alloc(length, fill = 0) {
      const buffer = new BufferPolyfill(Math.min(5e6, Math.max(0, length)));
      buffer.fill(typeof fill === "number" ? fill : 0);
      return buffer;
    }
    static concat(values) {
      return BufferPolyfill.from(values.flatMap((value) => [...value]));
    }
    static isBuffer(value) {
      return value instanceof BufferPolyfill;
    }
    static byteLength(value) {
      return new runtime.TextEncoder().encode(value).length;
    }
    toString(encoding = "utf8") {
      return encoding === "hex" ? bytesToHex(this) : encoding === "base64" ? bytesToBase64(this) : new runtime.TextDecoder().decode(this);
    }
  }
  class EventEmitter {
    listeners = /* @__PURE__ */ new Map();
    on(name, callback) {
      const values = this.listeners.get(name) ?? [];
      values.push(callback);
      this.listeners.set(name, values);
      return this;
    }
    addListener(name, callback) {
      return this.on(name, callback);
    }
    once(name, callback) {
      const wrapped = (...args2) => {
        this.off(name, wrapped);
        callback(...args2);
      };
      return this.on(name, wrapped);
    }
    off(name, callback) {
      this.listeners.set(name, (this.listeners.get(name) ?? []).filter((item) => item !== callback));
      return this;
    }
    removeListener(name, callback) {
      return this.off(name, callback);
    }
    removeAllListeners(name) {
      if (name === void 0) this.listeners.clear();
      else this.listeners.delete(name);
      return this;
    }
    emit(name, ...args2) {
      (this.listeners.get(name) ?? []).slice().forEach((callback) => callback(...args2));
      return (this.listeners.get(name)?.length ?? 0) > 0;
    }
    listenerCount(name) {
      return this.listeners.get(name)?.length ?? 0;
    }
  }
  const pathModule = {
    sep: "/",
    delimiter: ":",
    normalize: (value) => {
      const absolute = value.startsWith("/");
      const trailing = value.length > 1 && value.endsWith("/");
      const output = [];
      value.split("/").forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") {
          if (output.length && output.at(-1) !== "..") output.pop();
          else if (!absolute) output.push("..");
        } else output.push(part);
      });
      const normalized = `${absolute ? "/" : ""}${output.join("/")}` || (absolute ? "/" : ".");
      return trailing && normalized !== "/" && normalized !== "." ? `${normalized}/` : normalized;
    },
    join: (...values) => pathModule.normalize(values.filter(Boolean).join("/")),
    resolve: (...values) => {
      let joined = "";
      for (let index = values.length - 1; index >= 0; index -= 1) {
        joined = `${values[index]}/${joined}`;
        if (values[index].startsWith("/")) break;
      }
      return pathModule.normalize(joined.startsWith("/") ? joined : `/${joined}`);
    },
    dirname: (value) => value.replace(/\/[^/]*\/?$/, "") || ".",
    basename: (value, suffix) => {
      const name = value.split("/").filter(Boolean).at(-1) ?? "";
      return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
    },
    extname: (value) => {
      const name = value.split("/").at(-1) ?? "";
      const index = name.lastIndexOf(".");
      return index > 0 ? name.slice(index) : "";
    },
    isAbsolute: (value) => value.startsWith("/"),
    parse: (value) => {
      const dir = pathModule.dirname(value);
      const base = pathModule.basename(value);
      const ext = pathModule.extname(value);
      return { root: value.startsWith("/") ? "/" : "", dir, base, ext, name: base.slice(0, base.length - ext.length) };
    },
    format: (value) => `${value.dir || value.root || ""}${value.dir || value.root ? "/" : ""}${value.base || `${value.name || ""}${value.ext || ""}`}`.replace(/\/+/g, "/")
  };
  const util = {
    format: (format, ...values) => typeof format !== "string" ? [format, ...values].map((value) => typeof value === "object" ? JSON.stringify(value) : String(value)).join(" ") : boundedText(format).replace(/%[sdifoOj%]/g, (token) => {
      if (token === "%%") return "%";
      const value = values.shift();
      if (token === "%d" || token === "%i") return String(parseInt(String(value), 10));
      if (token === "%f") return String(parseFloat(String(value)));
      if (token === "%j" || token === "%o" || token === "%O") return JSON.stringify(value);
      return String(value);
    }) + (values.length ? ` ${values.map(String).join(" ")}` : ""),
    inspect: (value) => typeof value === "string" ? `'${value}'` : JSON.stringify(value, null, 2),
    types: { isDate: (value) => value instanceof Date, isRegExp: (value) => value instanceof RegExp, isPromise: (value) => Boolean(value && typeof value.then === "function") },
    promisify: (callback) => (...args2) => new Promise((resolve, reject) => callback(...args2, (error, value) => error ? reject(error) : resolve(value)))
  };
  class Readable extends EventEmitter {
    chunks = [];
    push(chunk) {
      if (chunk === null) {
        this.emit("end");
        return false;
      }
      this.chunks.push(chunk);
      this.emit("data", chunk);
      return true;
    }
    pipe(destination) {
      this.on("data", (chunk) => destination.write(chunk));
      this.on("end", () => destination.end?.());
      return destination;
    }
  }
  class Writable extends EventEmitter {
    chunks = [];
    write(chunk) {
      this.chunks.push(chunk);
      this.emit("data", chunk);
      return true;
    }
    end(chunk) {
      if (chunk !== void 0) this.write(chunk);
      this.emit("finish");
    }
  }
  class Transform extends Readable {
    write(chunk) {
      return this.push(chunk);
    }
    end(chunk) {
      if (chunk !== void 0) this.write(chunk);
      this.push(null);
    }
  }
  class StringDecoder {
    decoder;
    constructor(encoding = "utf-8") {
      this.decoder = new runtime.TextDecoder(encoding);
    }
    write(value) {
      return this.decoder.decode(value, { stream: true });
    }
    end(value) {
      return (value ? this.decoder.decode(value, { stream: true }) : "") + this.decoder.decode();
    }
  }
  const uuid = { v4: () => runtime.crypto.randomUUID(), v1: () => {
    const bytes = runtime.crypto.getRandomValues(new Uint8Array(16));
    const time = BigInt(Date.now()) * 10000n + 0x01b21dd213814000n;
    bytes[0] = Number(time >> 24n) & 255;
    bytes[1] = Number(time >> 16n) & 255;
    bytes[2] = Number(time >> 8n) & 255;
    bytes[3] = Number(time) & 255;
    bytes[6] = bytes[6] & 15 | 16;
    bytes[8] = bytes[8] & 63 | 128;
    const hex = bytesToHex(bytes);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }, validate: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)), version: (value) => parseInt(String(value).split("-")[2]?.[0] ?? "0", 16) };
  const punycode = { toASCII: (value) => {
    try {
      return new runtime.URL(`http://${value}`).hostname;
    } catch {
      return value;
    }
  }, toUnicode: (value) => value, ucs2: { decode: (value) => [...value].map((character) => character.codePointAt(0)), encode: (values) => String.fromCodePoint(...values) }, version: "bounded" };
  const modules = {
    ajv: Ajv,
    assert: assertion,
    atob: runtime.atob,
    btoa: runtime.btoa,
    buffer: { Buffer: BufferPolyfill, SlowBuffer: BufferPolyfill, INSPECT_MAX_BYTES: 50 },
    chai: { expect: runtime.expect, assert: assertion },
    cheerio,
    "crypto-js": cryptoJs,
    "csv-parse": csvParse,
    "csv-parse/sync": { parse: parseCsv },
    "csv-parse/lib/sync": parseCsv,
    events: Object.assign(EventEmitter, { EventEmitter, once: (emitter, name) => new Promise((resolve) => emitter.once(name, (...values) => resolve(values))) }),
    lodash,
    moment,
    path: Object.assign({}, pathModule, { posix: pathModule }),
    "postman-collection": postmanCollection,
    punycode,
    querystring,
    stream: { Readable, Writable, Transform, Duplex: Transform, PassThrough: Transform },
    "string-decoder": { StringDecoder },
    timers: { setTimeout: runtime.setTimeout, clearTimeout: runtime.clearTimeout, setInterval: runtime.setInterval, clearInterval: runtime.clearInterval },
    tv4,
    url: { URL: runtime.URL, URLSearchParams: runtime.URLSearchParams, parse: (value) => {
      const url = new runtime.URL(value);
      return { href: url.href, protocol: url.protocol, host: url.host, hostname: url.hostname, port: url.port, pathname: url.pathname, search: url.search, query: querystring.parse(url.search.slice(1)), hash: url.hash };
    }, format: (value) => value.href ? String(value.href) : `${value.protocol ?? "http:"}//${value.host ?? value.hostname ?? ""}${value.pathname ?? ""}${value.search ?? ""}${value.hash ?? ""}`, resolve: (from, to) => new runtime.URL(to, from).toString() },
    util,
    uuid,
    xml2js
  };
  return modules;
};

// src/lib/scriptSandbox.ts
var payloadBytes = (payload) => Math.floor(payload.dataBase64.length * 3 / 4) - (payload.dataBase64.endsWith("==") ? 2 : payload.dataBase64.endsWith("=") ? 1 : 0);
var payloadText = (payload) => {
  try {
    const bytes = Uint8Array.from(atob(payload.dataBase64), (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Script certificate file '${payload.fileName}' is not valid UTF-8 PEM text.`);
  }
};
var hydrateScriptFileReferences = async (request, references, readFile2, budget = { files: 0, bytes: 0 }) => {
  if (!references.length) return request;
  if (!readFile2) throw new Error("Script file access is disabled. Enable it in Preferences.");
  if (budget.files + references.length > 20) throw new Error("Script request exceeds the 20-file attachment limit.");
  budget.files += references.length;
  for (const reference of references) {
    const payload = await readFile2(reference.path);
    const bytes = payloadBytes(payload);
    if (bytes < 0 || bytes > 5e6) throw new Error(`Script file '${payload.fileName}' exceeds the 5 MB per-file limit.`);
    budget.bytes += bytes;
    if (budget.bytes > 2e7) throw new Error("Script request files exceed the 20 MB aggregate limit.");
    if (reference.kind === "body") {
      request.bodyMode = "binary";
      request.binaryBody = payload;
    } else if (reference.kind === "multipart") {
      const part = request.multipartBody.find((candidate) => candidate.id === reference.partId);
      if (!part) throw new Error(`Script multipart file target '${reference.partId}' was not found.`);
      part.kind = "file";
      part.file = payload;
      part.fileName = reference.fileName || payload.fileName;
      part.contentType = reference.contentType || payload.mimeType;
    } else if (reference.kind === "certificate-cert") {
      request.transport.clientCertificatePem = payloadText(payload);
    } else {
      request.transport.clientKeyPem = payloadText(payload);
    }
  }
  return request;
};
var resolveScriptFileReferencePaths = (references, variables) => references.map((reference) => {
  const path = reference.path.replace(/{{\s*([^{}]+?)\s*}}/g, (match, name) => variables[name] ?? match).trim();
  if (!path) throw new Error("Script file path cannot be empty.");
  if (path.length > 1e4) throw new Error("Script file path exceeds 10,000 characters.");
  return { ...reference, path };
});
var record2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
var stringValue = (value, fallback = "") => typeof value === "string" ? value : value === void 0 || value === null ? fallback : String(value);
var scriptRow = (value, index, prefix) => {
  const source = record2(value);
  if (!source) return void 0;
  const name = stringValue(source.key ?? source.name).trim();
  if (!name) return void 0;
  return { id: `${prefix}-${index}`, name, value: stringValue(source.value), enabled: source.enabled !== false, description: stringValue(source.description) };
};
var scriptHeaders = (value) => {
  if (Array.isArray(value)) return value.map((item, index) => scriptRow(item, index, "script-header")).filter((item) => Boolean(item));
  const source = record2(value);
  return source ? Object.entries(source).flatMap(([name, item], index) => {
    const values = Array.isArray(item) ? item : [item];
    return values.map((entry, offset) => ({ id: `script-header-${index}-${offset}`, name, value: stringValue(entry), enabled: true }));
  }) : [];
};
var assertHttpUrl = (value) => {
  const url = stringValue(value).trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d+)?(?:\/|$)/.test(url)) throw new Error("Script requests require an HTTP(S) URL or bare hostname.");
    try {
      parsed = new URL(`https://${url}`);
    } catch {
      throw new Error("Script requests require an HTTP(S) URL or bare hostname.");
    }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Script requests are limited to http:// and https:// URLs.");
  return parsed.toString();
};
var normalizeScriptSubrequestInput = (input, sourceRequest, allowFileReferences) => {
  const serialized = JSON.stringify(input);
  if (serialized && new Blob([serialized]).size > 256e3) throw new Error("Script request input exceeds the 256 KB bridge limit.");
  const source = typeof input === "string" ? { url: input } : record2(input);
  if (!source) throw new Error("Script requests must be a URL string or request object.");
  const request = createBlankRequest("Script request");
  const fileReferences = [];
  request.id = `script-request-${crypto.randomUUID()}`;
  request.url = assertHttpUrl(source.url);
  request.method = stringValue(source.method, "GET").trim().toUpperCase() || "GET";
  if (!/^[A-Z][A-Z0-9!#$%&'*+.^_`|~-]{0,31}$/.test(request.method)) throw new Error("Script request method is not a valid HTTP token.");
  request.headers = scriptHeaders(source.header ?? source.headers);
  request.transport = { ...sourceRequest.transport, timeoutMode: "custom", timeoutMs: Math.min(1e4, Math.max(1e3, sourceRequest.transport.timeoutMs)) };
  request.preRequestScript = "";
  request.tests = "";
  const auth = record2(source.auth);
  if (auth) {
    const type = stringValue(auth.type, "none").toLowerCase();
    const keyed = (name, key, fallback) => Array.isArray(auth[name]) ? record2(auth[name].find((item) => record2(item)?.key === key))?.value ?? fallback : fallback;
    request.auth.disabled = false;
    if (type === "basic") {
      request.auth.type = "basic";
      request.auth.username = stringValue(keyed("basic", "username", auth.username));
      request.auth.password = stringValue(keyed("basic", "password", auth.password));
    } else if (type === "bearer") {
      request.auth.type = "bearer";
      request.auth.token = stringValue(keyed("bearer", "token", auth.token ?? auth.accessToken));
      request.auth.prefix = stringValue(keyed("bearer", "prefix", auth.prefix), "Bearer");
    } else if (type === "apikey" || type === "api-key") {
      request.auth.type = "api-key";
      request.auth.apiKeyName = stringValue(keyed("apikey", "key", auth.key ?? auth.name));
      request.auth.apiKeyValue = stringValue(keyed("apikey", "value", auth.value));
      const location = keyed("apikey", "in", auth.in ?? auth.location);
      request.auth.apiKeyLocation = location === "query" ? "query" : "header";
    } else if (type !== "none" && type !== "noauth") throw new Error(`Script request auth type '${type}' is not supported.`);
  }
  const proxy = record2(source.proxy);
  if (proxy) {
    request.transport.proxyMode = "custom";
    if (proxy.url) request.transport.proxyUrl = stringValue(proxy.url);
    else if (proxy.host) request.transport.proxyUrl = `${stringValue(proxy.protocol, "http")}://${stringValue(proxy.host)}${proxy.port ? `:${stringValue(proxy.port)}` : ""}`;
    request.transport.proxyExclusions = Array.isArray(proxy.exclusions) ? proxy.exclusions.map(String).join(",") : stringValue(proxy.exclusions);
  }
  const certificate = record2(source.certificate);
  if (certificate) {
    const cert = record2(certificate.cert);
    const key = record2(certificate.key);
    const pfx = record2(certificate.pfx);
    if (pfx?.src || certificate.pfxPath || certificate.path) throw new Error("PFX certificate files are not supported by the native PEM transport.");
    const certPath = certificate.certPath ?? cert?.src;
    const keyPath = certificate.keyPath ?? key?.src;
    if ((certPath || keyPath) && !allowFileReferences) throw new Error("Script requests cannot read certificate file paths without script file access.");
    if (certPath) fileReferences.push({ kind: "certificate-cert", path: stringValue(certPath) });
    else request.transport.clientCertificatePem = stringValue(cert?.pem ?? certificate.cert ?? certificate.certificate);
    if (keyPath) fileReferences.push({ kind: "certificate-key", path: stringValue(keyPath) });
    else request.transport.clientKeyPem = stringValue(key?.pem ?? certificate.key);
    request.transport.clientCertificateDomains = Array.isArray(certificate.domains) ? certificate.domains.map(String).join(",") : stringValue(certificate.domains);
  }
  const body = source.body;
  if (typeof body === "string") {
    request.bodyMode = "text";
    request.body = body;
  } else if (record2(body)) {
    const bodySource = body;
    const mode = stringValue(bodySource.mode, "raw").toLowerCase();
    if (mode === "raw") {
      request.bodyMode = "text";
      request.body = stringValue(bodySource.raw);
    } else if (mode === "urlencoded") {
      request.bodyMode = "form-urlencoded";
      request.formBody = (Array.isArray(bodySource.urlencoded) ? bodySource.urlencoded : []).map((item, index) => scriptRow(item, index, "script-form")).filter((item) => Boolean(item));
    } else if (mode === "graphql") {
      const graphql = record2(bodySource.graphql) ?? bodySource;
      request.protocol = "graphql";
      request.method = "POST";
      request.graphql.query = stringValue(graphql.query);
      request.graphql.variables = typeof graphql.variables === "string" ? graphql.variables : JSON.stringify(graphql.variables ?? {}, null, 2);
      request.graphql.operationName = stringValue(graphql.operationName);
    } else if (mode === "formdata") {
      const parts = Array.isArray(bodySource.formdata) ? bodySource.formdata : [];
      request.bodyMode = "multipart";
      request.multipartBody = parts.flatMap((item, index) => {
        const part = record2(item);
        if (!part) return [];
        const row = scriptRow(part, index, "script-part");
        if (!row) return [];
        const isFile = part.type === "file" || part.src !== void 0;
        if (!isFile) return [{ ...row, kind: "text" }];
        if (!allowFileReferences) throw new Error("Script requests cannot read multipart file paths without script file access.");
        const path = Array.isArray(part.src) ? part.src[0] : part.src ?? part.value;
        fileReferences.push({ kind: "multipart", path: stringValue(path), partId: row.id, fileName: stringValue(part.fileName ?? part.filename), contentType: stringValue(part.contentType) });
        return [{ ...row, value: "", kind: "file", fileName: stringValue(part.fileName ?? part.filename), contentType: stringValue(part.contentType) }];
      });
    } else if (mode === "file") {
      if (!allowFileReferences) throw new Error("Script requests cannot read file paths without script file access.");
      const file = bodySource.file;
      const path = record2(file)?.src ?? file ?? bodySource.src;
      fileReferences.push({ kind: "body", path: stringValue(path) });
      request.bodyMode = "binary";
    } else {
      throw new Error(`Script request body mode '${mode}' is not supported.`);
    }
  }
  if (fileReferences.length > 20) throw new Error("Script request exceeds the 20-file attachment limit.");
  return { request, fileReferences };
};
var normalizeScriptSubrequestWithFiles = (input, sourceRequest) => normalizeScriptSubrequestInput(input, sourceRequest, true);
var prepareScriptSubrequest = async (input, sourceRequest, variables, readFile2, budget = { files: 0, bytes: 0 }) => {
  const normalized = normalizeScriptSubrequestWithFiles(input, sourceRequest);
  const references = resolveScriptFileReferencePaths(normalized.fileReferences, variables);
  return hydrateScriptFileReferences(normalized.request, references, readFile2, budget);
};
var sandboxPrefix = `
const pendingSubrequests = new Map();
self.addEventListener('message', ({ data }) => {
  if (data?.type !== 'subresponse') return;
  const pending = pendingSubrequests.get(data.id);
  if (!pending) return;
  pendingSubrequests.delete(data.id);
  if (data.error) pending.reject(new Error(data.error));
  else pending.resolve(data.response);
});
self.onmessage = async ({ data }) => {
  if (data?.type !== 'run') return;
  const state = structuredClone(data.state);
  const testNamePattern = state.testNamePattern === undefined ? undefined : new RegExp(state.testNamePattern);
  let registeredTests = 0;
  const hostPostMessage = self.postMessage.bind(self);
  const logs = [];
  const tests = [];
  const pendingTests = [];
  const fileReferences = [];
  let subrequestCount = 0;
  const constructors = [Function, (async () => {}).constructor, (function* () {}).constructor, (async function* () {}).constructor];
  constructors.forEach((constructor) => {
    try { Object.defineProperty(constructor.prototype, 'constructor', { value: undefined, writable: false, configurable: false }); }
    catch { /* The worker boundary remains the outer permission boundary. */ }
  });
  const denied = (capability) => () => { throw new Error(capability + ' is not available in the script sandbox.'); };
  const fetch = denied('Direct network access; enable and use insomnia.sendRequest()');
  const XMLHttpRequest = undefined;
  const WebSocket = undefined;
  const WebTransport = undefined;
  const EventSource = undefined;
  const Worker = undefined;
  const SharedWorker = undefined;
  const BroadcastChannel = undefined;
  const importScripts = denied('Module imports');
  const indexedDB = undefined;
  const caches = undefined;
  const navigator = undefined;
  const location = undefined;
  const document = undefined;
  const window = undefined;
  const pushLog = (value) => { if (logs.length < 1000) logs.push(String(value).slice(0, 20000)); };
  const console = {
    log: (...values) => pushLog(values.map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')),
    info: (...values) => pushLog(values.map(String).join(' ')),
    warn: (...values) => pushLog('[warn] ' + values.map(String).join(' ')),
    error: (...values) => pushLog('[error] ' + values.map(String).join(' ')),
  };
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  if (state.globalsAreBase) state.environment = state.baseGlobals;
  if (state.collectionVariablesAreBase) state.collectionVariables = state.baseEnvironment;
  const applyScope = (values, scope, disabled) => {
    (disabled || []).forEach((name) => delete values[name]);
    Object.assign(values, scope);
  };
  const mergedVariables = () => {
    const values = {};
    applyScope(values, state.baseGlobals, state.baseGlobalDisabled);
    if (!state.globalsAreBase) applyScope(values, state.environment, state.globalDisabled);
    applyScope(values, state.baseEnvironment, state.baseEnvironmentDisabled);
    if (!state.collectionVariablesAreBase) applyScope(values, state.collectionVariables, state.collectionDisabled);
    state.folders.forEach((folder) => { (folder.disabled || []).forEach((name) => delete values[name]); Object.assign(values, folder.environment); });
    return Object.assign(values, state.iterationData, state.localVariables);
  };
  const replaceIn = (value) => String(value).replace(/{{\\s*([^{}]+?)\\s*}}/g, (match, name) => mergedVariables()[name] ?? match);
  const removeFileReferences = (...kinds) => {
    for (let index = fileReferences.length - 1; index >= 0; index -= 1) if (kinds.includes(fileReferences[index].kind)) fileReferences.splice(index, 1);
  };
  const addFileReference = (reference) => {
    if (!state.permissions.files) throw new Error('Script file access is disabled. Enable it in Preferences.');
    const path = replaceIn(reference.path ?? '').trim();
    if (!path) throw new Error('Script file path cannot be empty.');
    if (path.length > 10000) throw new Error('Script file path exceeds 10,000 characters.');
    if (fileReferences.length >= 20) throw new Error('Script request exceeds the 20-file attachment limit.');
    fileReferences.push({ ...reference, path });
    return path;
  };
  const variableApi = (values, disabled = []) => ({
    get: (name) => values[name],
    set: (name, value) => {
      const key = String(name);
      const text = String(value);
      if (key.length > 256 || text.length > 1000000) throw new Error('Script variable exceeds the name or 1 MB value limit.');
      if (!Object.prototype.hasOwnProperty.call(values, key) && Object.keys(values).length >= 10000) throw new Error('Script variable scope exceeds 10,000 entries.');
      values[key] = text;
      const disabledIndex = disabled.indexOf(key);
      if (disabledIndex >= 0) disabled.splice(disabledIndex, 1);
    },
    unset: (name) => { const key = String(name); delete values[key]; const disabledIndex = disabled.indexOf(key); if (disabledIndex >= 0) disabled.splice(disabledIndex, 1); },
    has: (name) => Object.prototype.hasOwnProperty.call(values, name),
    clear: () => { Object.keys(values).forEach((name) => delete values[name]); disabled.splice(0); },
    toObject: () => ({ ...values }),
    replaceIn,
  });
  const expect = (${createScriptExpect.toString()})();
  const modules = (${createScriptModules.toString()})({
    atob,
    btoa,
    crypto,
    expect,
    structuredClone,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  const require = (name) => {
    if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name];
    throw new Error("Module '" + name + "' is not bundled in Brunomnia's script sandbox.");
  };
  const headerApi = {
    add: ({ key, name, value }) => { if (state.request.headers.length >= 500) throw new Error('Script request exceeds 500 headers.'); state.request.headers.push({ id: 'script-' + Date.now() + '-' + state.request.headers.length, name: String(key || name || '').slice(0, 1000), value: String(value).slice(0, 100000), enabled: true }); },
    remove: (name) => { state.request.headers = state.request.headers.filter((header) => header.name.toLowerCase() !== String(name).toLowerCase()); },
    get: (name) => state.request.headers.find((header) => header.enabled && header.name.toLowerCase() === String(name).toLowerCase())?.value,
    has: (name) => state.request.headers.some((header) => header.enabled && header.name.toLowerCase() === String(name).toLowerCase()),
    set: (name, value) => {
      const existing = state.request.headers.find((header) => header.name.toLowerCase() === String(name).toLowerCase());
      if (existing) { existing.value = String(value).slice(0, 100000); existing.enabled = true; }
      else { if (state.request.headers.length >= 500) throw new Error('Script request exceeds 500 headers.'); state.request.headers.push({ id: 'script-' + Date.now() + '-' + state.request.headers.length, name: String(name).slice(0, 1000), value: String(value).slice(0, 100000), enabled: true }); }
    },
  };
  let requestUrl = String(state.request.url || '');
  const urlApi = {
    addQueryParams: (items) => {
      const entries = typeof items === 'string'
        ? [...new URLSearchParams(items).entries()].map(([name, value]) => ({ name, value }))
        : Array.isArray(items) ? items : Object.entries(items || {}).map(([name, value]) => ({ name, value }));
      try {
        const url = new URL(requestUrl);
        entries.forEach((item) => { const name = item.name ?? item.key; if (name) url.searchParams.append(String(name), String(item.value ?? '')); });
        requestUrl = url.toString();
      } catch {
        const query = entries.flatMap((item) => { const name = item.name ?? item.key; return name ? [encodeURIComponent(String(name)) + '=' + encodeURIComponent(String(item.value ?? ''))] : []; }).join('&');
        if (query) requestUrl += (requestUrl.includes('?') ? '&' : '?') + query;
      }
      if (requestUrl.length > 100000) throw new Error('Script request URL exceeds 100 KB.');
      return urlApi;
    },
    getQueryString: () => { try { return new URL(requestUrl).searchParams.toString(); } catch { return requestUrl.split('?')[1]?.split('#')[0] || ''; } },
    toString: () => requestUrl,
    valueOf: () => requestUrl,
    [Symbol.toPrimitive]: () => requestUrl,
  };
  let requestBody = String(state.request.body || '');
  const bodyApi = {
    update: (body) => {
      const input = typeof body === 'string' ? { mode: 'raw', raw: body } : body || {};
      const mode = String(input.mode || 'raw').toLowerCase();
      if (mode === 'raw') { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; const next = String(input.raw ?? ''); if (next.length > 5000000) throw new Error('Script request body exceeds 5 MB.'); state.request.bodyMode = 'text'; requestBody = next; }
      else if (mode === 'urlencoded') { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; state.request.bodyMode = 'form-urlencoded'; state.request.formBody = (input.urlencoded || []).map((item, index) => ({ id: 'script-form-' + index, name: String(item.key ?? item.name ?? ''), value: String(item.value ?? ''), enabled: item.enabled !== false, description: String(item.description ?? '') })).filter((item) => item.name); }
      else if (mode === 'graphql') { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; const graphql = input.graphql || input; state.request.protocol = 'graphql'; state.request.method = 'POST'; state.request.graphql.query = String(graphql.query ?? ''); state.request.graphql.variables = typeof graphql.variables === 'string' ? graphql.variables : JSON.stringify(graphql.variables || {}, null, 2); state.request.graphql.operationName = String(graphql.operationName ?? ''); }
      else if (mode === 'formdata') {
        removeFileReferences('body', 'multipart'); delete state.request.binaryBody; state.request.bodyMode = 'multipart';
        const parts = Array.isArray(input.formdata) ? input.formdata : [];
        state.request.multipartBody = parts.slice(0, 1000).map((item, index) => {
          const id = 'script-part-' + index; const name = String(item.key ?? item.name ?? ''); const isFile = item.type === 'file' || item.src !== undefined;
          if (!name) return { id, name: '', value: '', enabled: false, kind: 'text' };
          if (isFile) { addFileReference({ kind: 'multipart', path: item.src ?? item.value, partId: id, fileName: String(item.fileName ?? item.filename ?? ''), contentType: String(item.contentType ?? '') }); return { id, name, value: '', enabled: item.enabled !== false, description: String(item.description ?? ''), kind: 'file', fileName: String(item.fileName ?? item.filename ?? ''), contentType: String(item.contentType ?? '') }; }
          return { id, name, value: String(item.value ?? ''), enabled: item.enabled !== false, description: String(item.description ?? ''), kind: 'text' };
        }).filter((item) => item.name);
      }
      else if (mode === 'file') { removeFileReferences('body', 'multipart'); const path = input.file?.src ?? input.file ?? input.src; addFileReference({ kind: 'body', path }); state.request.bodyMode = 'binary'; delete state.request.binaryBody; requestBody = ''; }
      else throw new Error("Request body mode '" + mode + "' is not supported.");
      return bodyApi;
    },
    toString: () => requestBody,
    valueOf: () => requestBody,
    [Symbol.toPrimitive]: () => requestBody,
  };
  Object.defineProperty(state.request, 'url', { configurable: true, enumerable: true, get: () => urlApi, set: (value) => { const next = String(value); if (next.length > 100000) throw new Error('Script request URL exceeds 100 KB.'); requestUrl = next; } });
  Object.defineProperty(state.request, 'body', { configurable: true, enumerable: true, get: () => bodyApi, set: (value) => { removeFileReferences('body', 'multipart'); delete state.request.binaryBody; const next = typeof value === 'string' ? value : JSON.stringify(value); if (next.length > 5000000) throw new Error('Script request body exceeds 5 MB.'); requestBody = next; state.request.bodyMode = 'text'; } });
  state.request.auth.update = (auth, requestedType) => {
    const input = auth || {};
    const type = String(requestedType || input.type || 'none').toLowerCase();
    const keyed = (name, key, fallback) => Array.isArray(input[name]) ? input[name].find((item) => item.key === key)?.value ?? fallback : fallback;
    state.request.auth.disabled = false;
    if (type === 'basic') { state.request.auth.type = 'basic'; state.request.auth.username = String(keyed('basic', 'username', input.username ?? '')); state.request.auth.password = String(keyed('basic', 'password', input.password ?? '')); }
    else if (type === 'bearer') { state.request.auth.type = 'bearer'; state.request.auth.token = String(keyed('bearer', 'token', input.token ?? input.accessToken ?? '')); state.request.auth.prefix = String(keyed('bearer', 'prefix', input.prefix ?? 'Bearer')); }
    else if (type === 'apikey' || type === 'api-key') { state.request.auth.type = 'api-key'; state.request.auth.apiKeyName = String(keyed('apikey', 'key', input.key ?? input.name ?? '')); state.request.auth.apiKeyValue = String(keyed('apikey', 'value', input.value ?? '')); const location = keyed('apikey', 'in', input.in ?? input.location); state.request.auth.apiKeyLocation = location === 'query' ? 'query' : 'header'; }
    else if (type === 'none' || type === 'noauth') { state.request.auth.type = 'none'; state.request.auth.disabled = true; }
    else throw new Error("Request auth type '" + type + "' is not supported by script mutation yet.");
  };
  state.request.proxy = {
    getProxyUrl: () => state.request.transport.proxyUrl,
    update: (proxy) => {
      const input = proxy || {};
      state.request.transport.proxyMode = 'custom';
      if (input.url) state.request.transport.proxyUrl = String(input.url);
      else if (input.host) state.request.transport.proxyUrl = String(input.protocol || 'http') + '://' + String(input.host) + (input.port ? ':' + String(input.port) : '');
      state.request.transport.proxyExclusions = Array.isArray(input.exclusions) ? input.exclusions.join(',') : String(input.exclusions ?? state.request.transport.proxyExclusions);
    },
  };
  const certificateApi = state.request.certificate = {
    key: { src: '' },
    cert: { src: '' },
    pfx: { src: '' },
    passphrase: '',
    update: (certificate) => {
      const input = certificate || {};
      removeFileReferences('certificate-cert', 'certificate-key');
      if (input.disabled === true) { state.request.transport.clientCertificatePem = ''; state.request.transport.clientKeyPem = ''; state.request.transport.clientCertificateDomains = ''; certificateApi.key.src = ''; certificateApi.cert.src = ''; certificateApi.pfx.src = ''; return; }
      if (input.pfx?.src || input.pfxPath) throw new Error('PFX certificate files are not supported by the native PEM transport.');
      const certPath = input.certPath ?? input.cert?.src; const keyPath = input.keyPath ?? input.key?.src;
      if (certPath) { certificateApi.cert.src = addFileReference({ kind: 'certificate-cert', path: certPath }); state.request.transport.clientCertificatePem = ''; }
      else state.request.transport.clientCertificatePem = String(input.cert?.pem ?? input.cert ?? input.certificate ?? '');
      if (keyPath) { certificateApi.key.src = addFileReference({ kind: 'certificate-key', path: keyPath }); state.request.transport.clientKeyPem = ''; }
      else state.request.transport.clientKeyPem = String(input.key?.pem ?? input.key ?? '');
      state.request.transport.clientCertificateDomains = Array.isArray(input.domains) ? input.domains.join(',') : String(input.domains ?? '');
    },
  };
  const responseFacade = (response) => {
    if (!response) return undefined;
    const headers = Object.entries(response.headers || {}).map(([key, value]) => ({ key, value }));
    headers.get = (name) => headers.find((header) => header.key.toLowerCase() === String(name).toLowerCase())?.value;
    headers.has = (name) => headers.some((header) => header.key.toLowerCase() === String(name).toLowerCase());
    headers.toObject = () => Object.fromEntries(headers.map(({ key, value }) => [key, value]));
    const cookieValues = (response.setCookies || []).map((header) => header.split(';')[0]);
    return {
      status: response.status,
      code: response.status,
      statusText: response.statusText,
      responseTime: response.durationMs,
      json: () => JSON.parse(response.body),
      text: () => response.body,
      headers,
      hasHeader: (name) => headers.has(name),
      getHeader: (name) => headers.get(name),
      cookies: {
        toObject: () => Object.fromEntries(cookieValues.map((pair) => { const split = pair.indexOf('='); return split > 0 ? [pair.slice(0, split).trim(), pair.slice(split + 1).trim()] : ['', '']; }).filter(([name]) => name)),
        get: (name) => { const pair = cookieValues.find((value) => value.slice(0, value.indexOf('=')).trim() === String(name)); return pair ? pair.slice(pair.indexOf('=') + 1).trim() : undefined; },
      },
    };
  };
  const sendRequest = (input, callback) => {
    const run = () => {
      if (!state.permissions.network) throw new Error('Script-initiated requests are disabled. Enable them in Preferences.');
      if (subrequestCount >= state.permissions.maxSubrequests) throw new Error('Script exceeded the secondary-request limit.');
      subrequestCount += 1;
      const id = 'subrequest-' + subrequestCount + '-' + Date.now();
      const promise = new Promise((resolve, reject) => pendingSubrequests.set(id, { resolve, reject }));
      hostPostMessage({ type: 'subrequest', id, input, variables: mergedVariables() });
      return promise.then(responseFacade);
    };
    if (typeof callback === 'function') { Promise.resolve().then(run).then((response) => callback(null, response), (error) => callback(error)); return undefined; }
    return Promise.resolve().then(run);
  };
  const baseGlobalApi = variableApi(state.baseGlobals, state.baseGlobalDisabled);
  const globalApi = variableApi(state.environment, state.globalsAreBase ? state.baseGlobalDisabled : state.globalDisabled);
  const baseEnvironmentApi = variableApi(state.baseEnvironment, state.baseEnvironmentDisabled);
  const collectionApi = variableApi(state.collectionVariables, state.collectionVariablesAreBase ? state.baseEnvironmentDisabled : state.collectionDisabled);
  const localApi = variableApi(state.localVariables);
  const iterationApi = variableApi(state.iterationData);
  const variablesApi = {
    get: (name) => mergedVariables()[name],
    set: localApi.set,
    unset: localApi.unset,
    has: (name) => Object.prototype.hasOwnProperty.call(mergedVariables(), name),
    clear: localApi.clear,
    toObject: mergedVariables,
    replaceIn,
    baseGlobalVars: baseGlobalApi,
    globalVars: globalApi,
    collectionVars: baseEnvironmentApi,
    collectionVariables: baseEnvironmentApi,
    environmentVars: collectionApi,
    localVars: localApi,
    iterationDataVars: iterationApi,
  };
  const folderFacade = (folder) => ({ id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) });
  const parentFolders = {
    get: (selector) => { const folder = [...state.folders].reverse().find((item) => item.id === String(selector) || item.name === String(selector)); return folder ? folderFacade(folder) : undefined; },
    getById: (id) => { const folder = state.folders.find((item) => item.id === String(id)); return folder ? folderFacade(folder) : undefined; },
    getByName: (name) => { const folder = [...state.folders].reverse().find((item) => item.name === String(name)); return folder ? folderFacade(folder) : undefined; },
    getEnvironments: () => [...state.folders].reverse().map((folder) => variableApi(folder.environment, folder.disabled)),
  };
  const insomnia = {
    baseGlobals: baseGlobalApi,
    globals: globalApi,
    environment: collectionApi,
    baseEnvironment: baseEnvironmentApi,
    CollectionVariables: baseEnvironmentApi,
    collectionVariables: baseEnvironmentApi,
    variables: variablesApi,
    localVars: localApi,
    iterationData: iterationApi,
    parentFolders,
    request: state.request,
    response: responseFacade(state.response),
    sendRequest,
    replaceIn,
    vault: { get: (name) => { if (!state.permissions.vault) throw new Error('Script vault access is disabled. Enable it in Preferences.'); return state.vault[String(name)]; } },
    expect,
    test: (name, callback) => {
      registeredTests += 1;
      if (registeredTests > 1000) throw new Error('Script exceeds 1,000 test registrations.');
      const testName = String(name);
      if (testNamePattern && !testNamePattern.test(testName)) return;
      const result = { name: testName, passed: true };
      tests.push(result);
      try {
        const outcome = callback();
        if (outcome && typeof outcome.then === 'function') pendingTests.push(Promise.resolve(outcome).catch((error) => { result.passed = false; result.error = error instanceof Error ? error.message : String(error); }));
      }
      catch (error) { result.passed = false; result.error = error instanceof Error ? error.message : String(error); }
    },
  };
  insomnia.request.headersApi = headerApi;
  insomnia.request.addHeader = headerApi.add;
  insomnia.request.removeHeader = headerApi.remove;
  insomnia.request.setHeader = headerApi.set;
  insomnia.request.getHeader = headerApi.get;
  insomnia.request.hasHeader = headerApi.has;
  insomnia.request.getUrl = () => requestUrl;
  insomnia.request.setUrl = (url) => { const next = String(url); if (next.length > 100000) throw new Error('Script request URL exceeds 100 KB.'); requestUrl = next; };
  insomnia.request.getMethod = () => insomnia.request.method;
  insomnia.request.setMethod = (method) => { insomnia.request.method = String(method).toUpperCase(); };
  insomnia.request.getBody = () => requestBody;
  insomnia.request.setBody = (body) => { removeFileReferences('body', 'multipart'); delete insomnia.request.binaryBody; const next = typeof body === 'string' ? body : JSON.stringify(body); if (next.length > 5000000) throw new Error('Script request body exceeds 5 MB.'); requestBody = next; insomnia.request.bodyMode = 'text'; };
  const cleanupRequest = () => {
    delete state.request.headersApi;
    delete state.request.addHeader;
    delete state.request.removeHeader;
    delete state.request.setHeader;
    delete state.request.getHeader;
    delete state.request.hasHeader;
    delete state.request.getUrl;
    delete state.request.setUrl;
    delete state.request.getMethod;
    delete state.request.setMethod;
    delete state.request.getBody;
    delete state.request.setBody;
    delete state.request.auth.update;
    delete state.request.proxy;
    delete state.request.certificate;
    delete state.request.url;
    state.request.url = requestUrl;
    delete state.request.body;
    state.request.body = requestBody;
  };
  try {
    const runUserScript = async function () {
      'use strict';
      const globalThis = undefined;
      const self = undefined;
      const state = undefined;
      const hostPostMessage = undefined;
      const pendingSubrequests = undefined;
      const constructors = undefined;
      const cleanupRequest = undefined;
      const subrequestCount = undefined;
      const requestUrl = undefined;
      const requestBody = undefined;
      const logs = undefined;
      const tests = undefined;
      const registeredTests = undefined;
      const testNamePattern = undefined;
      const pendingTests = undefined;
      const fileReferences = undefined;
      const Function = undefined;
      const WebAssembly = undefined;
      const WebTransport = undefined;
      const SharedWorker = undefined;
      const BroadcastChannel = undefined;
      const location = undefined;
      const postMessage = undefined;
      const onmessage = undefined;
`;

// cli/brunomnia.ts
init_transport();

// src/lib/storage.ts
init_core();

// src/lib/graphql.ts
init_http();
var record3 = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
var text = (value) => typeof value === "string" ? value : "";
var normalizeTypeRef = (value, depth = 0) => {
  const source = record3(value);
  const ofType = depth < 12 && source?.ofType ? normalizeTypeRef(source.ofType, depth + 1) : void 0;
  return { kind: text(source?.kind), name: text(source?.name), ...ofType?.kind || ofType?.name ? { ofType } : {} };
};
var normalizeInputValues = (value) => !Array.isArray(value) ? [] : value.flatMap((item) => {
  const source = record3(item);
  const name = text(source?.name);
  return source && name ? [{ name, description: text(source.description), defaultValue: text(source.defaultValue), type: normalizeTypeRef(source.type) }] : [];
}).slice(0, 500);
var normalizeGraphqlSchema = (value) => {
  const source = record3(value);
  const rawTypes = Array.isArray(source?.types) ? source.types : [];
  const types = rawTypes.flatMap((item) => {
    const type = record3(item);
    const name = text(type?.name);
    if (!type || !name) return [];
    const fields = !Array.isArray(type.fields) ? [] : type.fields.flatMap((item2) => {
      const field = record3(item2);
      const fieldName = text(field?.name);
      return field && fieldName ? [{
        name: fieldName,
        description: text(field.description),
        isDeprecated: field.isDeprecated === true,
        deprecationReason: text(field.deprecationReason),
        args: normalizeInputValues(field.args).slice(0, 100),
        type: normalizeTypeRef(field.type)
      }] : [];
    }).slice(0, 1e3);
    const enumValues = !Array.isArray(type.enumValues) ? [] : type.enumValues.flatMap((item2) => {
      const entry = record3(item2);
      const entryName = text(entry?.name);
      return entry && entryName ? [{ name: entryName, description: text(entry.description), isDeprecated: entry.isDeprecated === true, deprecationReason: text(entry.deprecationReason) }] : [];
    }).slice(0, 5e3);
    const possibleTypes = !Array.isArray(type.possibleTypes) ? [] : type.possibleTypes.map((entry) => normalizeTypeRef(entry)).filter((entry) => entry.name).slice(0, 1e3);
    return [{ kind: text(type.kind), name, description: text(type.description), fields, inputFields: normalizeInputValues(type.inputFields), enumValues, possibleTypes }];
  }).slice(0, 5e3);
  if (!types.length) return void 0;
  return {
    queryType: text(record3(source?.queryType)?.name),
    mutationType: text(record3(source?.mutationType)?.name),
    subscriptionType: text(record3(source?.subscriptionType)?.name),
    types
  };
};

// src/lib/storage.ts
init_request();
var isWorkspaceEnvelope = (value) => {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return candidate.format === "brunomnia" && Array.isArray(candidate.collections);
};
var requestDefaults = () => cloneSeedWorkspace().collections[0].requests[0];
var knownPluginPermissions = ["request:read", "request:write", "response:read", "response:write", "store", "network", "app:prompt", "app:clipboard", "template", "action", "theme"];
var governanceRoles = ["owner", "admin", "editor", "viewer"];
var storageModes = ["local", "folder", "git", "encrypted-file"];
var record4 = (value) => value && typeof value === "object" ? value : void 0;
var stringValue2 = (value, fallback = "") => typeof value === "string" ? value : fallback;
var normalizeRows = (value, prefix) => !Array.isArray(value) ? [] : value.flatMap((item, index) => {
  const row = record4(item);
  if (!row) return [];
  return [{ id: stringValue2(row.id, `${prefix}-${index}`), name: stringValue2(row.name), value: stringValue2(row.value), enabled: row.enabled !== false, description: stringValue2(row.description).slice(0, 2e4), ...row.multiline === true ? { multiline: true } : {} }];
}).slice(0, 1e3);
var normalizePlugins = (value) => !Array.isArray(value) ? [] : value.flatMap((item, index) => {
  if (!item || typeof item !== "object") return [];
  const plugin = item;
  if (typeof plugin.source !== "string" || !plugin.source.trim()) return [];
  const permissions = (candidate) => Array.isArray(candidate) ? knownPluginPermissions.filter((permission) => candidate.includes(permission)) : [];
  return [{
    id: typeof plugin.id === "string" && plugin.id ? plugin.id : `migrated-plugin-${index}`,
    name: typeof plugin.name === "string" && plugin.name ? plugin.name : "Local plugin",
    version: typeof plugin.version === "string" && plugin.version ? plugin.version : "0.0.0-local",
    description: typeof plugin.description === "string" ? plugin.description : "",
    source: plugin.source,
    sourcePath: typeof plugin.sourcePath === "string" ? plugin.sourcePath : void 0,
    sourceFormat: plugin.sourceFormat === "brunomnia" ? "brunomnia" : "insomnia-commonjs",
    enabled: plugin.enabled === true,
    requestedPermissions: permissions(plugin.requestedPermissions),
    grantedPermissions: permissions(plugin.grantedPermissions),
    installedAt: typeof plugin.installedAt === "string" ? plugin.installedAt : (/* @__PURE__ */ new Date(0)).toISOString(),
    error: typeof plugin.error === "string" ? plugin.error : void 0
  }];
});
var normalizeGovernance = (value, defaults) => {
  const source = record4(value);
  const rawMembers = Array.isArray(source?.members) ? source.members : [];
  const members = rawMembers.flatMap((value2, index) => {
    const member = record4(value2);
    if (!member) return [];
    const role = governanceRoles.includes(member.role) ? member.role : "viewer";
    return [{
      id: typeof member.id === "string" && member.id ? member.id : `migrated-member-${index}`,
      name: typeof member.name === "string" && member.name ? member.name : "Imported member",
      email: typeof member.email === "string" ? member.email : "",
      role,
      active: member.active !== false
    }];
  });
  const safeMembers = members.length ? members : defaults.members;
  if (!safeMembers.some((member) => member.active && member.role === "owner")) safeMembers[0] = { ...safeMembers[0], role: "owner", active: true };
  const rawPolicy = record4(source?.policy);
  const requestedStorage = Array.isArray(rawPolicy?.allowedStorage) ? rawPolicy.allowedStorage : [];
  const externalVaultAllowlist = Array.isArray(rawPolicy?.externalVaultAllowlist) ? rawPolicy.externalVaultAllowlist : [];
  const allowedStorage = requestedStorage.length ? storageModes.filter((mode) => requestedStorage.includes(mode)) : defaults.policy.allowedStorage;
  const auditRetention = Math.min(1e4, Math.max(1, Number(rawPolicy?.auditRetention) || defaults.policy.auditRetention));
  const policy = {
    allowedStorage: allowedStorage.length ? allowedStorage : defaults.policy.allowedStorage,
    requireEncryptedSync: rawPolicy?.requireEncryptedSync !== false,
    requireVaultForSecrets: rawPolicy?.requireVaultForSecrets !== false,
    externalVaultAllowlist: externalVaultAllowlist.filter((value2) => typeof value2 === "string").slice(0, 1e3),
    auditRetention
  };
  const audit = (Array.isArray(source?.audit) ? source.audit : []).flatMap((value2) => {
    const event = record4(value2);
    if (!event || typeof event.action !== "string" || typeof event.timestamp !== "string") return [];
    return [{ id: typeof event.id === "string" ? event.id : `audit-${crypto.randomUUID()}`, timestamp: event.timestamp, actorId: typeof event.actorId === "string" ? event.actorId : safeMembers[0].id, action: event.action, detail: typeof event.detail === "string" ? event.detail : "" }];
  }).slice(0, auditRetention);
  const requestedCurrent = typeof source?.currentMemberId === "string" ? source.currentMemberId : "";
  const currentMemberId = safeMembers.some((member) => member.id === requestedCurrent && member.active) ? requestedCurrent : safeMembers.find((member) => member.active)?.id ?? safeMembers[0].id;
  return { currentMemberId, members: safeMembers, policy, audit };
};
var normalizeCollaboration = (value, defaults) => {
  const source = record4(value);
  return {
    mode: source?.mode === "encrypted-file" ? "encrypted-file" : "off",
    path: typeof source?.path === "string" ? source.path : defaults.path,
    actor: typeof source?.actor === "string" ? source.actor : defaults.actor,
    revision: Math.max(0, Number(source?.revision) || 0),
    lastPulledAt: typeof source?.lastPulledAt === "string" ? source.lastPulledAt : void 0,
    lastPushedAt: typeof source?.lastPushedAt === "string" ? source.lastPushedAt : void 0
  };
};
var normalizeMcpResources = (value) => !Array.isArray(value) ? [] : value.flatMap((item) => {
  const resource = record4(item);
  const uriTemplate = stringValue2(resource?.uriTemplate);
  const uri = stringValue2(resource?.uri, uriTemplate);
  if (!resource || !uri) return [];
  let variables = [];
  if (uriTemplate) {
    variables = [...uriTemplate.matchAll(/\{[+#./;?&]?([^{}]+)\}/g)].flatMap((match) => match[1].split(",").map((name) => name.replace(/\*$/, "").replace(/:\d+$/, ""))).filter((name, index, all) => Boolean(name) && all.indexOf(name) === index).slice(0, 100);
  }
  return [{ uri, uriTemplate, variables, name: stringValue2(resource.name, uri), description: stringValue2(resource.description), mimeType: stringValue2(resource.mimeType) }];
}).slice(0, 5e3);
var normalizeMcpClients = (value) => !Array.isArray(value) ? [] : value.flatMap((item, index) => {
  const client = record4(item);
  if (!client) return [];
  const authType = client.authType === "bearer" || client.authType === "basic" || client.authType === "oauth2" ? client.authType : "none";
  const tools = !Array.isArray(client.tools) ? [] : client.tools.flatMap((item2) => {
    const tool = record4(item2);
    const name = stringValue2(tool?.name);
    if (!tool || !name) return [];
    return [{ name, description: stringValue2(tool.description), inputSchema: tool.inputSchema ?? {} }];
  }).slice(0, 5e3);
  const prompts = !Array.isArray(client.prompts) ? [] : client.prompts.flatMap((item2) => {
    const prompt = record4(item2);
    const name = stringValue2(prompt?.name);
    if (!prompt || !name) return [];
    const args2 = Array.isArray(prompt.arguments) ? prompt.arguments.flatMap((item3) => {
      const argument = record4(item3);
      const argumentName = stringValue2(argument?.name);
      return argument && argumentName ? [{ name: argumentName, description: stringValue2(argument.description), required: argument.required === true }] : [];
    }).slice(0, 500) : [];
    return [{ name, description: stringValue2(prompt.description), arguments: args2 }];
  }).slice(0, 5e3);
  return [{
    id: stringValue2(client.id, `migrated-mcp-${index}`),
    name: stringValue2(client.name, `MCP Client ${index + 1}`),
    enabled: client.enabled === true,
    transport: client.transport === "stdio" ? "stdio" : "http",
    url: stringValue2(client.url),
    command: stringValue2(client.command),
    args: Array.isArray(client.args) ? client.args.filter((arg) => typeof arg === "string").slice(0, 100) : [],
    headers: normalizeRows(client.headers, `mcp-${index}-header`),
    authType,
    token: stringValue2(client.token),
    username: stringValue2(client.username),
    password: stringValue2(client.password),
    oauthAuthorizationUrl: stringValue2(client.oauthAuthorizationUrl),
    oauthAccessTokenUrl: stringValue2(client.oauthAccessTokenUrl),
    oauthClientId: stringValue2(client.oauthClientId),
    oauthClientSecret: stringValue2(client.oauthClientSecret),
    oauthScope: stringValue2(client.oauthScope),
    oauthState: stringValue2(client.oauthState),
    oauthRefreshToken: stringValue2(client.oauthRefreshToken),
    oauthIdentityToken: stringValue2(client.oauthIdentityToken),
    oauthExpiresAt: typeof client.oauthExpiresAt === "number" && Number.isFinite(client.oauthExpiresAt) ? Math.max(0, Math.trunc(client.oauthExpiresAt)) : 0,
    oauthTokenPrefix: stringValue2(client.oauthTokenPrefix, "Bearer"),
    oauthRegisteredClientId: stringValue2(client.oauthRegisteredClientId),
    oauthRegisteredClientSecret: stringValue2(client.oauthRegisteredClientSecret),
    oauthRegisteredClientIdIssuedAt: typeof client.oauthRegisteredClientIdIssuedAt === "number" && Number.isFinite(client.oauthRegisteredClientIdIssuedAt) ? Math.max(0, Math.trunc(client.oauthRegisteredClientIdIssuedAt)) : 0,
    oauthRegisteredClientSecretExpiresAt: typeof client.oauthRegisteredClientSecretExpiresAt === "number" && Number.isFinite(client.oauthRegisteredClientSecretExpiresAt) ? Math.max(0, Math.trunc(client.oauthRegisteredClientSecretExpiresAt)) : 0,
    oauthRegisteredTokenEndpointAuthMethod: client.oauthRegisteredTokenEndpointAuthMethod === "client_secret_basic" || client.oauthRegisteredTokenEndpointAuthMethod === "client_secret_post" ? client.oauthRegisteredTokenEndpointAuthMethod : "none",
    roots: Array.isArray(client.roots) ? client.roots.filter((root) => typeof root === "string").slice(0, 100) : [],
    tools,
    prompts,
    resources: normalizeMcpResources(client.resources),
    resourceTemplates: normalizeMcpResources(client.resourceTemplates),
    lastSyncedAt: typeof client.lastSyncedAt === "string" ? client.lastSyncedAt : void 0
  }];
}).slice(0, 100);
var normalizeAi = (value, defaults) => {
  const source = record4(value);
  const provider = source?.provider === "openai" || source?.provider === "anthropic" || source?.provider === "gemini" || source?.provider === "openai-compatible" ? source.provider : defaults.provider;
  return {
    enabled: source?.enabled === true,
    provider,
    baseUrl: stringValue2(source?.baseUrl, defaults.baseUrl),
    model: stringValue2(source?.model),
    apiKey: stringValue2(source?.apiKey),
    mockGeneration: source?.mockGeneration === true,
    commitSuggestions: source?.commitSuggestions === true
  };
};
var normalizeKonnect = (value, defaults) => {
  const source = record4(value);
  const controlPlanes = !Array.isArray(source?.controlPlanes) ? [] : source.controlPlanes.flatMap((item) => {
    const plane = record4(item);
    const id = stringValue2(plane?.id);
    return plane && id ? [{ id, name: stringValue2(plane.name, id), description: stringValue2(plane.description) }] : [];
  }).slice(0, 1e3);
  return {
    enabled: source?.enabled === true,
    baseUrl: stringValue2(source?.baseUrl, defaults.baseUrl),
    token: stringValue2(source?.token),
    controlPlaneId: stringValue2(source?.controlPlaneId),
    controlPlanes,
    lastSyncedAt: typeof source?.lastSyncedAt === "string" ? source.lastSyncedAt : void 0
  };
};
var normalizePreferences = (value) => {
  const source = record4(value);
  const rawShortcuts = record4(source?.shortcuts);
  const shortcuts = Object.fromEntries(Object.keys(defaultShortcuts).map((action) => {
    const candidate = typeof rawShortcuts?.[action] === "string" ? normalizeShortcut(rawShortcuts[action].slice(0, 64)) : "";
    return [action, candidate || defaultShortcuts[action]];
  }));
  return {
    theme: source?.theme === "dark" || source?.theme === "light" ? source.theme : "system",
    density: source?.density === "compact" ? "compact" : "comfortable",
    fontSize: Math.min(24, Math.max(8, Number(source?.fontSize) || defaultPreferences.fontSize)),
    interfaceFontSize: Math.min(24, Math.max(8, Number(source?.interfaceFontSize) || defaultPreferences.interfaceFontSize)),
    fontInterface: stringValue2(source?.fontInterface).replace(/[\r\n]/g, " ").slice(0, 512),
    fontMonospace: stringValue2(source?.fontMonospace).replace(/[\r\n]/g, " ").slice(0, 512),
    showPasswords: source?.showPasswords === true,
    allowHtmlPreviewRemoteResources: source?.allowHtmlPreviewRemoteResources === true,
    allowHtmlPreviewScripts: source?.allowHtmlPreviewScripts === true,
    disableResponsePreviewLinks: source?.disableResponsePreviewLinks === true,
    preferredHttpVersion: source?.preferredHttpVersion === "http1.0" || source?.preferredHttpVersion === "http1.1" || source?.preferredHttpVersion === "http2" || source?.preferredHttpVersion === "http2-prior-knowledge" ? source.preferredHttpVersion : "default",
    maxRedirects: typeof source?.maxRedirects === "number" && Number.isFinite(source.maxRedirects) ? Math.max(-1, Math.trunc(source.maxRedirects)) : defaultPreferences.maxRedirects,
    followRedirects: source?.followRedirects !== false,
    maxTimelineDataSizeKB: typeof source?.maxTimelineDataSizeKB === "number" && Number.isFinite(source.maxTimelineDataSizeKB) ? Math.max(0, Math.trunc(source.maxTimelineDataSizeKB)) : defaultPreferences.maxTimelineDataSizeKB,
    maxHistoryResponses: typeof source?.maxHistoryResponses === "number" && Number.isFinite(source.maxHistoryResponses) ? Math.max(-1, Math.trunc(source.maxHistoryResponses)) : defaultPreferences.maxHistoryResponses,
    filterResponsesByEnv: source?.filterResponsesByEnv === true,
    requestTimeoutMs: typeof source?.requestTimeoutMs === "number" && Number.isFinite(source.requestTimeoutMs) ? Math.min(2147483647, Math.max(0, Math.trunc(source.requestTimeoutMs))) : defaultPreferences.requestTimeoutMs,
    validateCertificates: source?.validateCertificates !== false,
    validateAuthCertificates: source?.validateAuthCertificates !== false,
    proxyEnabled: source?.proxyEnabled === true,
    httpProxy: stringValue2(source?.httpProxy).slice(0, 4096),
    httpsProxy: stringValue2(source?.httpsProxy).slice(0, 4096),
    noProxy: stringValue2(source?.noProxy).slice(0, 2e4),
    useBulkHeaderEditor: source?.useBulkHeaderEditor === true,
    useBulkParametersEditor: source?.useBulkParametersEditor === true,
    forceVerticalLayout: source?.forceVerticalLayout === true,
    editorIndentWithTabs: source?.editorIndentWithTabs !== false,
    editorIndentSize: Math.min(16, Math.max(1, Math.trunc(Number(source?.editorIndentSize) || defaultPreferences.editorIndentSize))),
    editorLineWrapping: source?.editorLineWrapping !== false,
    fontVariantLigatures: source?.fontVariantLigatures === true,
    scriptTimeoutMs: Math.min(6e4, Math.max(1e3, Number(source?.scriptTimeoutMs) || defaultPreferences.scriptTimeoutMs)),
    allowScriptRequests: source?.allowScriptRequests === true,
    allowScriptFileAccess: source?.allowScriptFileAccess === true,
    dataFolders: Array.isArray(source?.dataFolders) ? [...new Set(source.dataFolders.filter((value2) => typeof value2 === "string").map((value2) => value2.trim().slice(0, 4096)).filter(Boolean))].slice(0, 100) : [],
    enableVaultInScripts: source?.enableVaultInScripts === true,
    autoFetchGraphqlSchema: source?.autoFetchGraphqlSchema !== false,
    confirmDestructive: source?.confirmDestructive !== false,
    shortcuts
  };
};
var normalizeResponseTimeline = (value) => !Array.isArray(value) ? [] : value.slice(0, 1e3).flatMap((entry) => {
  const source = record4(entry);
  if (!source) return [];
  const name = source.name === "DataOut" ? "DataOut" : "Text";
  const elapsedMs = Number(source.elapsedMs);
  return [{
    name,
    value: stringValue2(source.value),
    elapsedMs: Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0,
    ...source.hidden === true ? { hidden: true } : {}
  }];
});
var normalizeStoredResponses = (value) => Array.isArray(value) ? value.flatMap((entry, index) => {
  const source = record4(entry);
  if (!source) return [];
  const { bodyBase64: encodedBody, ...response } = source;
  const bodyBase64 = typeof encodedBody === "string" && encodedBody.length ? encodedBody : void 0;
  return [{
    ...response,
    id: stringValue2(source.id, `legacy-response-${index}`),
    requestId: stringValue2(source.requestId),
    requestName: stringValue2(source.requestName),
    requestUrl: stringValue2(source.requestUrl),
    environmentId: stringValue2(source.environmentId),
    receivedAt: stringValue2(source.receivedAt, (/* @__PURE__ */ new Date(0)).toISOString()),
    body: stringValue2(source.body),
    ...bodyBase64 ? { bodyBase64 } : {},
    timeline: normalizeResponseTimeline(source.timeline)
  }];
}) : [];
var normalizeStreamMessages = (value, sessionId) => {
  const messages = (Array.isArray(value) ? value : []).slice(-5e3).flatMap((entry, index) => {
    const source = record4(entry);
    if (!source) return [];
    const direction = source.direction === "incoming" || source.direction === "outgoing" ? source.direction : "system";
    return [{
      id: stringValue2(source.id, `${sessionId}-event-${index}`),
      sessionId,
      direction,
      kind: stringValue2(source.kind, "event").slice(0, 500),
      text: stringValue2(source.text).slice(0, 1048576),
      timestamp: stringValue2(source.timestamp, (/* @__PURE__ */ new Date(0)).toISOString())
    }];
  });
  let characters = messages.reduce((total, message) => total + message.text.length, 0);
  while (messages.length > 1 && characters > 5e6) characters -= messages.shift().text.length;
  return messages;
};
var normalizeStreamHeaders = (value) => {
  const source = record4(value);
  if (!source) return void 0;
  return Object.fromEntries(Object.entries(source).slice(0, 500).map(([name, headerValue]) => [name.slice(0, 8192), stringValue2(headerValue).slice(0, 65536)]));
};
var normalizeStoredStreamSessions = (value, requestIds) => (Array.isArray(value) ? value : []).slice(0, 5e3).flatMap((entry, index) => {
  const source = record4(entry);
  if (!source) return [];
  const requestId = stringValue2(source.requestId);
  if (!requestIds.has(requestId)) return [];
  const protocol = source.protocol === "graphql" || source.protocol === "websocket" || source.protocol === "sse" ? source.protocol : "socketio";
  const id = stringValue2(source.id, `legacy-stream-${index}`);
  const endedAt = stringValue2(source.endedAt);
  const requestSnapshot = record4(source.requestSnapshot);
  const status = typeof source.status === "number" && Number.isFinite(source.status) ? Math.min(999, Math.max(0, Math.trunc(source.status))) : void 0;
  const durationMs = typeof source.durationMs === "number" && Number.isFinite(source.durationMs) ? Math.max(0, Math.trunc(source.durationMs)) : void 0;
  const headers = normalizeStreamHeaders(source.headers);
  return [{
    id,
    requestId,
    requestName: stringValue2(source.requestName),
    requestUrl: stringValue2(source.requestUrl),
    environmentId: stringValue2(source.environmentId),
    protocol,
    startedAt: stringValue2(source.startedAt, (/* @__PURE__ */ new Date(0)).toISOString()),
    ...endedAt ? { endedAt } : {},
    messages: normalizeStreamMessages(source.messages, id),
    ...requestSnapshot?.id === requestId ? { requestSnapshot: structuredClone(requestSnapshot) } : {},
    ...status !== void 0 ? { status } : {},
    ...typeof source.statusText === "string" ? { statusText: source.statusText.slice(0, 500) } : {},
    ...headers ? { headers } : {},
    ...typeof source.httpVersion === "string" ? { httpVersion: source.httpVersion.slice(0, 100) } : {},
    ...durationMs !== void 0 ? { durationMs } : {},
    ...typeof source.transport === "string" ? { transport: source.transport.slice(0, 200) } : {},
    ...Array.isArray(source.timeline) ? { timeline: normalizeResponseTimeline(source.timeline) } : {}
  }];
});
var normalizeResponseFilters = (value, requestIds) => {
  const source = record4(value);
  if (!source) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([requestId, entry]) => {
    if (!requestIds.has(requestId)) return [];
    const state = record4(entry);
    const filter = stringValue2(state?.filter).trim().slice(0, 2e3);
    const previewMode = state?.previewMode === "friendly" || state?.previewMode === "raw" ? state.previewMode : "source";
    const seen = /* @__PURE__ */ new Set();
    const history = (Array.isArray(state?.history) ? state.history : []).flatMap((candidate) => {
      const normalized = stringValue2(candidate).trim().slice(0, 2e3);
      return normalized && !seen.has(normalized) && Boolean(seen.add(normalized)) ? [normalized] : [];
    }).slice(0, 10);
    return [[requestId, { filter, history, previewMode }]];
  }));
};
var normalizeFolders = (value, defaultAuth) => {
  const source = !Array.isArray(value) ? [] : value.slice(0, 1e3);
  const folders = source.flatMap((item, index) => {
    const folder = record4(item);
    if (!folder) return [];
    const id = stringValue2(folder.id, `migrated-folder-${index}`);
    return [{
      id,
      name: stringValue2(folder.name, `Folder ${index + 1}`),
      parentId: stringValue2(folder.parentId),
      expanded: folder.expanded !== false,
      headers: normalizeRows(folder.headers, `${id}-header`),
      environment: normalizeRows(folder.environment, `${id}-environment`),
      auth: folder.auth ? { ...defaultAuth, ...record4(folder.auth) } : void 0,
      preRequestScript: stringValue2(folder.preRequestScript),
      tests: stringValue2(folder.tests),
      documentation: stringValue2(folder.documentation)
    }];
  });
  const ids = new Set(folders.map((folder) => folder.id));
  const normalized = folders.map((folder) => ({ ...folder, parentId: folder.parentId !== folder.id && ids.has(folder.parentId) ? folder.parentId : "" }));
  const byId = new Map(normalized.map((folder) => [folder.id, folder]));
  normalized.forEach((folder) => {
    const visited = /* @__PURE__ */ new Set([folder.id]);
    let current = folder;
    while (current.parentId) {
      if (visited.has(current.parentId)) {
        folder.parentId = "";
        break;
      }
      visited.add(current.parentId);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  });
  return normalized;
};
var normalizeCollectionEnvironments = (value, collectionId) => !Array.isArray(value) ? [] : value.slice(0, 500).flatMap((item, index) => {
  const environment = record4(item);
  if (!environment) return [];
  const id = stringValue2(environment.id, `${collectionId}-sub-environment-${index}`);
  return [{
    id,
    name: stringValue2(environment.name, `Environment ${index + 1}`),
    variables: normalizeRows(environment.variables, `${id}-variable`)
  }];
});
var normalizeEnvironments = (value, fallback) => {
  if (!Array.isArray(value) || !value.length) return fallback;
  const environments = value.slice(0, 500).flatMap((item, index) => {
    const environment = record4(item);
    if (!environment) return [];
    const id = stringValue2(environment.id, `migrated-environment-${index}`);
    const color = stringValue2(environment.color);
    return [{ id, name: stringValue2(environment.name, `Environment ${index + 1}`), variables: normalizeRows(environment.variables, `${id}-variable`), parentId: stringValue2(environment.parentId), private: environment.private === true, color: /^#[0-9a-f]{6}$/i.test(color) ? color : "", source: environment.source }];
  });
  if (!environments.length) return fallback;
  const ids = new Set(environments.map((environment) => environment.id));
  const normalized = environments.map((environment) => ({ ...environment, parentId: environment.parentId !== environment.id && ids.has(environment.parentId ?? "") ? environment.parentId : "" }));
  const byId = new Map(normalized.map((environment) => [environment.id, environment]));
  normalized.forEach((environment) => {
    const visited = /* @__PURE__ */ new Set([environment.id]);
    let current = environment;
    while (current.parentId) {
      if (visited.has(current.parentId)) {
        environment.parentId = "";
        break;
      }
      visited.add(current.parentId);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
  });
  for (let pass = 0; pass < normalized.length; pass += 1) {
    let changed = false;
    normalized.forEach((environment) => {
      const parent = environment.parentId ? byId.get(environment.parentId) : void 0;
      if (parent?.private && !environment.private) {
        environment.private = true;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return normalized;
};
var migrateWorkspace = (value) => {
  if (!isWorkspaceEnvelope(value)) throw new Error("This is not a Brunomnia workspace export.");
  const seed = cloneSeedWorkspace();
  const workspace = value;
  const defaults = requestDefaults();
  const importedCollections = workspace.collections.map((collection2) => ({
    ...collection2,
    folders: normalizeFolders(collection2.folders, defaults.auth),
    environment: normalizeRows(collection2.environment, `${collection2.id}-environment`),
    subEnvironments: normalizeCollectionEnvironments(collection2.subEnvironments, collection2.id),
    activeSubEnvironmentId: stringValue2(collection2.activeSubEnvironmentId),
    documentation: stringValue2(collection2.documentation),
    requests: collection2.requests.map((request) => {
      const graphql = record4(request.graphql);
      const socketIo = record4(request.socketIo);
      const requestId = stringValue2(request.id, `migrated-request-${crypto.randomUUID()}`);
      const method = normalizeHttpMethod(stringValue2(request.method, defaults.method), defaults.method);
      const protocol = request.protocol === "http" || request.protocol === "graphql" || request.protocol === "websocket" || request.protocol === "socketio" || request.protocol === "sse" || request.protocol === "grpc" ? request.protocol : defaults.protocol;
      const followRedirectsMode = request.transport?.followRedirectsMode === "global" || request.transport?.followRedirectsMode === "on" || request.transport?.followRedirectsMode === "off" ? request.transport.followRedirectsMode : request.transport?.followRedirects === false ? "off" : "global";
      const timeoutMode = request.transport?.timeoutMode === "global" || request.transport?.timeoutMode === "custom" ? request.transport.timeoutMode : typeof request.transport?.timeoutMs === "number" ? "custom" : "global";
      const validateCertificatesMode = request.transport?.validateCertificatesMode === "global" || request.transport?.validateCertificatesMode === "on" || request.transport?.validateCertificatesMode === "off" ? request.transport.validateCertificatesMode : typeof request.transport?.validateCertificates === "boolean" ? request.transport.validateCertificates ? "on" : "off" : "global";
      const proxyMode = request.transport?.proxyMode === "global" || request.transport?.proxyMode === "custom" || request.transport?.proxyMode === "disabled" ? request.transport.proxyMode : stringValue2(request.transport?.proxyUrl).trim() || stringValue2(request.transport?.proxyExclusions).trim() ? "custom" : "global";
      return {
        ...defaults,
        ...request,
        id: requestId,
        protocol,
        method,
        folderId: stringValue2(request.folderId),
        inheritFolderAuth: request.inheritFolderAuth === true,
        documentation: stringValue2(request.documentation),
        pathParams: normalizeRows(request.pathParams, `${requestId}-path`),
        params: normalizeRows(request.params, `${requestId}-query`),
        headers: normalizeRows(request.headers, `${requestId}-header`),
        bodyMode: request.bodyMode ?? (method === "GET" || method === "HEAD" ? "none" : "json"),
        renderBodyTemplates: request.renderBodyTemplates !== false,
        auth: {
          ...defaults.auth,
          ...request.auth,
          expiresAt: typeof request.auth?.expiresAt === "number" && Number.isFinite(request.auth.expiresAt) ? Math.max(0, Math.trunc(request.auth.expiresAt)) : 0
        },
        graphql: {
          ...defaults.graphql,
          ...request.graphql,
          schema: normalizeGraphqlSchema(graphql?.schema),
          schemaEndpoint: stringValue2(graphql?.schemaEndpoint),
          schemaFetchedAt: stringValue2(graphql?.schemaFetchedAt)
        },
        grpc: { ...defaults.grpc, ...request.grpc, metadata: normalizeRows(record4(request.grpc)?.metadata, `${requestId}-metadata`) },
        transport: {
          ...defaults.transport,
          ...request.transport,
          followRedirects: followRedirectsMode !== "off",
          followRedirectsMode,
          timeoutMode,
          timeoutMs: typeof request.transport?.timeoutMs === "number" && Number.isFinite(request.transport.timeoutMs) ? Math.min(2147483647, Math.max(0, Math.trunc(request.transport.timeoutMs))) : defaults.transport.timeoutMs,
          validateCertificates: validateCertificatesMode !== "off",
          validateCertificatesMode,
          proxyMode
        },
        sse: {
          ...defaults.sse,
          ...request.sse,
          autoReconnect: request.sse?.autoReconnect !== false,
          reconnectDelayMs: Math.min(6e4, Math.max(100, Number(request.sse?.reconnectDelayMs) || defaults.sse.reconnectDelayMs)),
          maxReconnects: Math.min(1e3, Math.max(0, Number(request.sse?.maxReconnects) || 0)),
          respectServerRetry: request.sse?.respectServerRetry !== false,
          sendLastEventId: request.sse?.sendLastEventId !== false
        },
        socketIo: {
          path: stringValue2(socketIo?.path, defaults.socketIo.path).slice(0, 2048),
          eventName: stringValue2(socketIo?.eventName, defaults.socketIo.eventName).slice(0, 500),
          args: (Array.isArray(socketIo?.args) ? socketIo.args : defaults.socketIo.args).flatMap((value2, index) => {
            const arg = record4(value2);
            if (!arg) return [];
            return [{
              id: stringValue2(arg.id, `${requestId}-socketio-arg-${index}`),
              value: stringValue2(arg.value).slice(0, 1048576),
              mode: arg.mode === "text" ? "text" : "json"
            }];
          }).slice(0, 100),
          ack: socketIo?.ack === true,
          eventListeners: (Array.isArray(socketIo?.eventListeners) ? socketIo.eventListeners : []).flatMap((value2, index) => {
            const listener = record4(value2);
            if (!listener) return [];
            return [{
              id: stringValue2(listener.id, `${requestId}-socketio-listener-${index}`),
              eventName: stringValue2(listener.eventName).slice(0, 500),
              description: stringValue2(listener.description ?? listener.desc).slice(0, 2e4),
              enabled: listener.enabled === true || listener.isOpen === true
            }];
          }).slice(0, 500)
        },
        formBody: normalizeRows(request.formBody, `${requestId}-form`),
        multipartBody: (request.multipartBody ?? []).map((part) => ({ ...part, multiline: part.multiline === true, contentType: part.contentType ?? part.file?.mimeType ?? "", fileName: part.fileName ?? part.file?.fileName ?? "" }))
      };
    })
  }));
  const collections = (importedCollections.length ? importedCollections : seed.collections).map((collection2) => {
    const folderIds = new Set((collection2.folders ?? []).map((folder) => folder.id));
    const resourceIds = /* @__PURE__ */ new Set([...folderIds, ...collection2.requests.map((request) => request.id)]);
    const orderedIds = Array.isArray(collection2.resourceOrder) ? collection2.resourceOrder : [];
    const seenResourceIds = /* @__PURE__ */ new Set();
    const resourceOrder = [
      ...orderedIds,
      ...(collection2.folders ?? []).map((folder) => folder.id),
      ...collection2.requests.map((request) => request.id)
    ].filter((id) => typeof id === "string" && resourceIds.has(id) && !seenResourceIds.has(id) && Boolean(seenResourceIds.add(id)));
    const subEnvironmentIds = new Set((collection2.subEnvironments ?? []).map((environment) => environment.id));
    return {
      ...collection2,
      resourceOrder,
      activeSubEnvironmentId: subEnvironmentIds.has(collection2.activeSubEnvironmentId ?? "") ? collection2.activeSubEnvironmentId : "",
      requests: collection2.requests.map((request) => ({ ...request, folderId: request.folderId && folderIds.has(request.folderId) ? request.folderId : "" }))
    };
  });
  const environments = normalizeEnvironments(workspace.environments, seed.environments);
  const requestIds = new Set(collections.flatMap((collection2) => collection2.requests.map((request) => request.id)));
  const environmentIds = new Set(environments.map((environment) => environment.id));
  const governance = normalizeGovernance(workspace.governance, seed.governance);
  return {
    ...workspace,
    version: 28,
    name: workspace.name || "Imported Workspace",
    activeRequestId: requestIds.has(workspace.activeRequestId) ? workspace.activeRequestId : collections[0]?.requests[0]?.id ?? "",
    activeEnvironmentId: environmentIds.has(workspace.activeEnvironmentId) ? workspace.activeEnvironmentId : environments[0].id,
    environments,
    history: Array.isArray(workspace.history) ? workspace.history : [],
    apiDesigns: (workspace.apiDesigns ?? seed.apiDesigns).map((design) => ({ ...design, ruleset: design.ruleset ?? "" })),
    mockServers: workspace.mockServers ?? seed.mockServers,
    runnerReports: workspace.runnerReports ?? [],
    imports: workspace.imports ?? [],
    cookies: workspace.cookies ?? [],
    responses: normalizeStoredResponses(workspace.responses),
    streamSessions: normalizeStoredStreamSessions(workspace.streamSessions, requestIds),
    responseFilters: normalizeResponseFilters(workspace.responseFilters, requestIds),
    project: { ...seed.project, ...workspace.project },
    plugins: normalizePlugins(workspace.plugins),
    pluginData: workspace.pluginData ?? {},
    activePluginTheme: workspace.activePluginTheme ?? "",
    collaboration: normalizeCollaboration(workspace.collaboration, seed.collaboration),
    governance,
    mcpClients: normalizeMcpClients(workspace.mcpClients),
    ai: normalizeAi(workspace.ai, seed.ai),
    konnect: normalizeKonnect(workspace.konnect, seed.konnect),
    preferences: normalizePreferences(workspace.preferences),
    collections
  };
};

// cli/brunomnia.ts
var args = process.argv.slice(2);
var flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : void 0;
};
var hasFlag = (name) => args.includes(name);
var fail = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};
var loadText = async (path) => (0, import_promises.readFile)(path, "utf8").catch((error) => fail(`Unable to read ${path}: ${error.message}`));
var scriptFileMime = (path) => ({
  ".cer": "application/x-pem-file",
  ".crt": "application/x-pem-file",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".key": "application/x-pem-file",
  ".pdf": "application/pdf",
  ".pem": "application/x-pem-file",
  ".png": "image/png",
  ".txt": "text/plain",
  ".xml": "application/xml"
})[(0, import_node_path.extname)(path).toLowerCase()] ?? "application/octet-stream";
var readCliScriptFile = async (path) => {
  const bytes = await (0, import_promises.readFile)(path);
  if (bytes.byteLength > 5e6) throw new Error(`Script file '${path}' exceeds the 5 MB per-file limit.`);
  return { fileName: (0, import_node_path.basename)(path) || "attachment.bin", mimeType: scriptFileMime(path), dataBase64: bytes.toString("base64") };
};
var loadWorkspace = async (path) => {
  const parsed = JSON.parse(await loadText(path));
  try {
    return migrateWorkspace(parsed);
  } catch {
    return fail("The input is not a Brunomnia workspace.");
  }
};
var expectApi = createScriptExpect();
var runNodeScript = async (source, originalRequest, originalEnvironment, response, timeoutMs = 1e4, originalLocalVariables = {}, iterationData = {}, options = {}) => {
  const request = structuredClone(originalRequest);
  const globalsAreBase = options.globalsAreBase === true;
  const collectionVariablesAreBase = options.collectionVariablesAreBase === true;
  const baseGlobals = { ...options.baseGlobals ?? (globalsAreBase ? originalEnvironment : {}) };
  const environment = globalsAreBase ? baseGlobals : { ...originalEnvironment };
  const baseEnvironment = { ...options.baseEnvironment ?? (collectionVariablesAreBase ? options.collectionVariables : {}) };
  const collectionVariables = collectionVariablesAreBase ? baseEnvironment : { ...options.collectionVariables ?? {} };
  const baseGlobalDisabled = [...options.baseGlobalDisabled ?? []];
  const globalDisabled = [...options.globalDisabled ?? []];
  const baseEnvironmentDisabled = [...options.baseEnvironmentDisabled ?? []];
  const collectionDisabled = [...options.collectionDisabled ?? []];
  const folders = structuredClone(options.folders ?? []);
  const localVariables = { ...originalLocalVariables };
  const logs = [];
  const tests = [];
  const pendingTests = [];
  const testNamePattern = options.testNamePattern === void 0 ? void 0 : new RegExp(options.testNamePattern);
  let registeredTests = 0;
  const fileReferences = [];
  const fileBudget = { files: 0, bytes: 0 };
  if (!source.trim()) return { request, environment, baseGlobals, baseGlobalDisabled, globalDisabled, collectionVariables, baseEnvironment, baseEnvironmentDisabled, collectionDisabled, folders, localVariables, logs, tests };
  const mergedVariables = () => {
    const values = {};
    const applyScope = (scope, disabled = []) => {
      disabled.forEach((name) => delete values[name]);
      Object.assign(values, scope);
    };
    applyScope(baseGlobals, baseGlobalDisabled);
    if (!globalsAreBase) applyScope(environment, globalDisabled);
    applyScope(baseEnvironment, baseEnvironmentDisabled);
    if (!collectionVariablesAreBase) applyScope(collectionVariables, collectionDisabled);
    folders.forEach((folder) => {
      (folder.disabled ?? []).forEach((name) => delete values[name]);
      Object.assign(values, folder.environment);
    });
    return { ...values, ...iterationData, ...localVariables };
  };
  const removeFileReferences = (...kinds) => {
    for (let index = fileReferences.length - 1; index >= 0; index -= 1) if (kinds.includes(fileReferences[index].kind)) fileReferences.splice(index, 1);
  };
  const addFileReference = (reference) => {
    if (!options.readFile) throw new Error("Script file access is disabled. Re-run trusted workspaces with --allow-script-files.");
    const path = reference.path.replace(/{{\s*([^{}]+?)\s*}}/g, (match, name) => mergedVariables()[name] ?? match).trim();
    if (!path) throw new Error("Script file path cannot be empty.");
    if (path.length > 1e4) throw new Error("Script file path exceeds 10,000 characters.");
    if (fileReferences.length >= 20) throw new Error("Script request exceeds the 20-file attachment limit.");
    fileReferences.push({ ...reference, path });
    return path;
  };
  const variableApi = (values, disabled = []) => ({
    get: (name) => values[name],
    set: (name, value) => {
      values[name] = String(value);
      const index = disabled.indexOf(name);
      if (index >= 0) disabled.splice(index, 1);
    },
    unset: (name) => {
      delete values[name];
      const index = disabled.indexOf(name);
      if (index >= 0) disabled.splice(index, 1);
    },
    has: (name) => Object.hasOwn(values, name),
    clear: () => {
      Object.keys(values).forEach((name) => delete values[name]);
      disabled.splice(0);
    },
    toObject: () => ({ ...values }),
    replaceIn: (value) => String(value).replace(/{{\s*([^{}]+?)\s*}}/g, (match, name) => mergedVariables()[name] ?? match)
  });
  const requestWithHelpers = request;
  requestWithHelpers.addHeader = ({ key, name, value }) => {
    request.headers.push({ id: `cli-script-${Date.now()}-${request.headers.length}`, name: key || name || "", value: String(value), enabled: true });
  };
  requestWithHelpers.removeHeader = (name) => {
    request.headers = request.headers.filter((header) => header.name.toLowerCase() !== name.toLowerCase());
  };
  requestWithHelpers.setHeader = (name, value) => {
    const existing = request.headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.value = String(value);
      existing.enabled = true;
    } else request.headers.push({ id: `cli-script-${Date.now()}-${request.headers.length}`, name, value: String(value), enabled: true });
  };
  requestWithHelpers.getHeader = (name) => request.headers.find((header) => header.enabled && header.name.toLowerCase() === name.toLowerCase())?.value;
  requestWithHelpers.hasHeader = (name) => request.headers.some((header) => header.enabled && header.name.toLowerCase() === name.toLowerCase());
  let requestUrl = request.url;
  const urlApi = {
    addQueryParams: (items) => {
      const entries = typeof items === "string" ? [...new URLSearchParams(items).entries()].map(([name, value]) => ({ name, value })) : Array.isArray(items) ? items : Object.entries(items ?? {}).map(([name, value]) => ({ name, value }));
      try {
        const parsed = new URL(requestUrl);
        entries.forEach((item) => {
          const name = item.name ?? item.key;
          if (name) parsed.searchParams.append(name, String(item.value ?? ""));
        });
        requestUrl = parsed.toString();
      } catch {
        const query = entries.flatMap((item) => {
          const name = item.name ?? item.key;
          return name ? [`${encodeURIComponent(name)}=${encodeURIComponent(String(item.value ?? ""))}`] : [];
        }).join("&");
        if (query) requestUrl += `${requestUrl.includes("?") ? "&" : "?"}${query}`;
      }
      return urlApi;
    },
    getQueryString: () => {
      try {
        return new URL(requestUrl).searchParams.toString();
      } catch {
        return requestUrl.split("?")[1]?.split("#")[0] ?? "";
      }
    },
    toString: () => requestUrl,
    valueOf: () => requestUrl,
    [Symbol.toPrimitive]: () => requestUrl
  };
  let requestBody = request.body;
  const bodyApi = {
    update: (body) => {
      const input = typeof body === "string" ? { mode: "raw", raw: body } : body && typeof body === "object" ? body : {};
      const mode = String(input.mode ?? "raw").toLowerCase();
      if (mode === "raw") {
        removeFileReferences("body", "multipart");
        delete request.binaryBody;
        request.bodyMode = "text";
        requestBody = String(input.raw ?? "");
      } else if (mode === "urlencoded") {
        removeFileReferences("body", "multipart");
        delete request.binaryBody;
        request.bodyMode = "form-urlencoded";
        request.formBody = (Array.isArray(input.urlencoded) ? input.urlencoded : []).flatMap((item, index) => {
          const row = item;
          const name = String(row.key ?? row.name ?? "");
          return name ? [{ id: `cli-form-${index}`, name, value: String(row.value ?? ""), enabled: row.enabled !== false }] : [];
        });
      } else if (mode === "graphql") {
        removeFileReferences("body", "multipart");
        delete request.binaryBody;
        const graphql = input.graphql && typeof input.graphql === "object" ? input.graphql : input;
        request.protocol = "graphql";
        request.method = "POST";
        request.graphql.query = String(graphql.query ?? "");
        request.graphql.variables = typeof graphql.variables === "string" ? graphql.variables : JSON.stringify(graphql.variables ?? {}, null, 2);
        request.graphql.operationName = String(graphql.operationName ?? "");
      } else if (mode === "formdata") {
        removeFileReferences("body", "multipart");
        delete request.binaryBody;
        request.bodyMode = "multipart";
        const parts = (Array.isArray(input.formdata) ? input.formdata : []).slice(0, 1e3);
        request.multipartBody = parts.flatMap((part, index) => {
          const id = `cli-part-${index}`;
          const name = String(part.key ?? part.name ?? "");
          if (!name) return [];
          const isFile = part.type === "file" || part.src !== void 0;
          if (isFile) {
            addFileReference({ kind: "multipart", path: String(part.src ?? part.value ?? ""), partId: id, fileName: String(part.fileName ?? part.filename ?? ""), contentType: String(part.contentType ?? "") });
            return [{ id, name, value: "", enabled: part.enabled !== false, kind: "file", fileName: String(part.fileName ?? part.filename ?? ""), contentType: String(part.contentType ?? "") }];
          }
          return [{ id, name, value: String(part.value ?? ""), enabled: part.enabled !== false, kind: "text" }];
        });
      } else if (mode === "file") {
        removeFileReferences("body", "multipart");
        const file = input.file;
        const path = file && typeof file === "object" ? file.src : file ?? input.src;
        addFileReference({ kind: "body", path: String(path ?? "") });
        request.bodyMode = "binary";
        delete request.binaryBody;
        requestBody = "";
      } else throw new Error(`Request body mode '${mode}' is not supported.`);
      return bodyApi;
    },
    toString: () => requestBody,
    valueOf: () => requestBody,
    [Symbol.toPrimitive]: () => requestBody
  };
  Object.defineProperty(request, "url", { configurable: true, enumerable: true, get: () => urlApi, set: (value) => {
    requestUrl = String(value);
  } });
  Object.defineProperty(request, "body", { configurable: true, enumerable: true, get: () => bodyApi, set: (value) => {
    removeFileReferences("body", "multipart");
    delete request.binaryBody;
    requestBody = typeof value === "string" ? value : JSON.stringify(value);
    request.bodyMode = "text";
  } });
  requestWithHelpers.getUrl = () => requestUrl;
  requestWithHelpers.setUrl = (url) => {
    requestUrl = String(url);
  };
  requestWithHelpers.getMethod = () => request.method;
  requestWithHelpers.setMethod = (method) => {
    request.method = String(method).toUpperCase();
  };
  requestWithHelpers.getBody = () => requestBody;
  requestWithHelpers.setBody = (body) => {
    removeFileReferences("body", "multipart");
    delete request.binaryBody;
    requestBody = typeof body === "string" ? body : JSON.stringify(body);
    request.bodyMode = "text";
  };
  const authWithUpdate = request.auth;
  authWithUpdate.update = (input, requestedType) => {
    const type = String(requestedType ?? input.type ?? "none").toLowerCase();
    const keyed = (name, key, fallback) => Array.isArray(input[name]) ? input[name].find((item) => item.key === key)?.value ?? fallback : fallback;
    request.auth.disabled = false;
    if (type === "basic") {
      request.auth.type = "basic";
      request.auth.username = String(keyed("basic", "username", input.username ?? ""));
      request.auth.password = String(keyed("basic", "password", input.password ?? ""));
    } else if (type === "bearer") {
      request.auth.type = "bearer";
      request.auth.token = String(keyed("bearer", "token", input.token ?? input.accessToken ?? ""));
      request.auth.prefix = String(keyed("bearer", "prefix", input.prefix ?? "Bearer"));
    } else if (type === "apikey" || type === "api-key") {
      request.auth.type = "api-key";
      request.auth.apiKeyName = String(keyed("apikey", "key", input.key ?? input.name ?? ""));
      request.auth.apiKeyValue = String(keyed("apikey", "value", input.value ?? ""));
      const location = keyed("apikey", "in", input.in ?? input.location);
      request.auth.apiKeyLocation = location === "query" ? "query" : "header";
    } else if (type === "none" || type === "noauth") {
      request.auth.type = "none";
      request.auth.disabled = true;
    } else throw new Error(`Request auth type '${type}' is not supported by script mutation yet.`);
  };
  requestWithHelpers.proxy = { getProxyUrl: () => request.transport.proxyUrl, update: (input) => {
    request.transport.proxyMode = "custom";
    if (input.url) request.transport.proxyUrl = String(input.url);
    else if (input.host) request.transport.proxyUrl = `${String(input.protocol ?? "http")}://${String(input.host)}${input.port ? `:${String(input.port)}` : ""}`;
    request.transport.proxyExclusions = Array.isArray(input.exclusions) ? input.exclusions.join(",") : String(input.exclusions ?? request.transport.proxyExclusions);
  } };
  const certificateApi = requestWithHelpers.certificate = { key: { src: "" }, cert: { src: "" }, pfx: { src: "" }, passphrase: "", update: (input) => {
    removeFileReferences("certificate-cert", "certificate-key");
    if (input.disabled === true) {
      request.transport.clientCertificatePem = "";
      request.transport.clientKeyPem = "";
      request.transport.clientCertificateDomains = "";
      certificateApi.key.src = "";
      certificateApi.cert.src = "";
      certificateApi.pfx.src = "";
      return;
    }
    const key = input.key;
    const cert = input.cert;
    const pfx = input.pfx;
    if (pfx?.src || input.pfxPath) throw new Error("PFX certificate files are not supported by the native PEM transport.");
    const certPath = input.certPath ?? cert?.src;
    const keyPath = input.keyPath ?? key?.src;
    if (certPath) {
      certificateApi.cert.src = addFileReference({ kind: "certificate-cert", path: String(certPath) });
      request.transport.clientCertificatePem = "";
    } else request.transport.clientCertificatePem = String(cert?.pem ?? input.cert ?? input.certificate ?? "");
    if (keyPath) {
      certificateApi.key.src = addFileReference({ kind: "certificate-key", path: String(keyPath) });
      request.transport.clientKeyPem = "";
    } else request.transport.clientKeyPem = String(key?.pem ?? input.key ?? "");
    request.transport.clientCertificateDomains = Array.isArray(input.domains) ? input.domains.join(",") : String(input.domains ?? "");
  } };
  const baseGlobalApi = variableApi(baseGlobals, baseGlobalDisabled);
  const globalApi = variableApi(environment, globalsAreBase ? baseGlobalDisabled : globalDisabled);
  const baseEnvironmentApi = variableApi(baseEnvironment, baseEnvironmentDisabled);
  const collectionApi = variableApi(collectionVariables, collectionVariablesAreBase ? baseEnvironmentDisabled : collectionDisabled);
  const localApi = variableApi(localVariables);
  const iterationApi = variableApi(iterationData);
  const variablesApi = {
    get: (name) => mergedVariables()[name],
    set: localApi.set,
    unset: localApi.unset,
    has: (name) => Object.hasOwn(mergedVariables(), name),
    clear: localApi.clear,
    toObject: mergedVariables,
    replaceIn: localApi.replaceIn,
    baseGlobalVars: baseGlobalApi,
    globalVars: globalApi,
    collectionVars: baseEnvironmentApi,
    collectionVariables: baseEnvironmentApi,
    environmentVars: collectionApi,
    localVars: localApi,
    iterationDataVars: iterationApi
  };
  const responseFacade = (candidate) => {
    if (!candidate) return void 0;
    const headers = Object.entries(candidate.headers).map(([key, value]) => ({ key, value }));
    headers.get = (name) => headers.find((header) => header.key.toLowerCase() === name.toLowerCase())?.value;
    headers.has = (name) => headers.some((header) => header.key.toLowerCase() === name.toLowerCase());
    headers.toObject = () => Object.fromEntries(headers.map(({ key, value }) => [key, value]));
    const cookieValues = (candidate.setCookies ?? []).map((header) => header.split(";")[0]);
    return {
      status: candidate.status,
      code: candidate.status,
      statusText: candidate.statusText,
      responseTime: candidate.durationMs,
      json: () => JSON.parse(candidate.body),
      text: () => candidate.body,
      headers,
      hasHeader: (name) => headers.has(name),
      getHeader: (name) => headers.get(name),
      cookies: {
        toObject: () => Object.fromEntries(cookieValues.flatMap((pair) => {
          const split = pair.indexOf("=");
          return split > 0 ? [[pair.slice(0, split).trim(), pair.slice(split + 1).trim()]] : [];
        })),
        get: (name) => {
          const pair = cookieValues.find((value) => value.slice(0, value.indexOf("=")).trim() === name);
          return pair ? pair.slice(pair.indexOf("=") + 1).trim() : void 0;
        }
      }
    };
  };
  const insomnia = {
    baseGlobals: baseGlobalApi,
    globals: globalApi,
    environment: collectionApi,
    baseEnvironment: baseEnvironmentApi,
    CollectionVariables: baseEnvironmentApi,
    collectionVariables: baseEnvironmentApi,
    variables: variablesApi,
    localVars: localApi,
    iterationData: iterationApi,
    parentFolders: {
      get: (selector) => {
        const folder = [...folders].reverse().find((item) => item.id === selector || item.name === selector);
        return folder ? { id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) } : void 0;
      },
      getById: (id) => {
        const folder = folders.find((item) => item.id === id);
        return folder ? { id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) } : void 0;
      },
      getByName: (name) => {
        const folder = [...folders].reverse().find((item) => item.name === name);
        return folder ? { id: folder.id, name: folder.name, environment: variableApi(folder.environment, folder.disabled) } : void 0;
      },
      getEnvironments: () => [...folders].reverse().map((folder) => variableApi(folder.environment, folder.disabled))
    },
    request,
    response: responseFacade(response),
    replaceIn: (value) => String(value).replace(/{{\s*([^{}]+?)\s*}}/g, (match, name) => mergedVariables()[name] ?? match),
    vault: { get: (name) => {
      if (!options.vault) throw new Error("Script vault access is disabled.");
      return options.vault[name];
    } },
    sendRequest: async (input, callback) => {
      const run = async () => {
        if (!options.sendRequest) throw new Error("Script-initiated requests are disabled.");
        const variables = mergedVariables();
        const subrequest = await prepareScriptSubrequest(input, request, variables, options.readFile, fileBudget);
        return responseFacade(await options.sendRequest(subrequest, variables));
      };
      if (callback) {
        void run().then((result) => callback(null, result), (error) => callback(error instanceof Error ? error : new Error(String(error))));
        return void 0;
      }
      return run();
    },
    expect: expectApi,
    test: (name, callback) => {
      registeredTests += 1;
      if (registeredTests > 1e3) throw new Error("Script exceeds 1,000 test registrations.");
      const testName = String(name);
      if (testNamePattern && !testNamePattern.test(testName)) return;
      const result = { name: testName, passed: true };
      tests.push(result);
      try {
        const outcome = callback();
        if (outcome && typeof outcome.then === "function") pendingTests.push(Promise.resolve(outcome).catch((error) => {
          result.passed = false;
          result.error = error instanceof Error ? error.message : String(error);
        }));
      } catch (error) {
        result.passed = false;
        result.error = error instanceof Error ? error.message : String(error);
      }
    }
  };
  const scriptModules = createScriptModules({
    atob,
    btoa,
    crypto,
    expect: expectApi,
    structuredClone,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  });
  const context = import_node_vm.default.createContext({
    insomnia,
    expect: expectApi,
    require: (name) => {
      if (!Object.hasOwn(scriptModules, name)) throw new Error(`Module '${name}' is not bundled in Brunomnia's script sandbox.`);
      return scriptModules[name];
    },
    console: {
      log: (...values) => logs.push(values.map(String).join(" ")),
      info: (...values) => logs.push(values.map(String).join(" ")),
      warn: (...values) => logs.push(`[warn] ${values.map(String).join(" ")}`),
      error: (...values) => logs.push(`[error] ${values.map(String).join(" ")}`)
    },
    structuredClone,
    JSON,
    URL,
    URLSearchParams
  }, { codeGeneration: { strings: false, wasm: false } });
  const script = new import_node_vm.default.Script(`(async () => { ${source}
 })()`, { filename: `${request.name}.script.js` });
  let timeout;
  try {
    await Promise.race([
      Promise.resolve(script.runInContext(context, { timeout: timeoutMs })),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Script exceeded the ${timeoutMs} ms execution limit.`)), timeoutMs);
      })
    ]);
    await Promise.all(pendingTests);
  } finally {
    if (timeout) clearTimeout(timeout);
    delete requestWithHelpers.addHeader;
    delete requestWithHelpers.removeHeader;
    delete requestWithHelpers.setHeader;
    delete requestWithHelpers.getHeader;
    delete requestWithHelpers.hasHeader;
    delete requestWithHelpers.getUrl;
    delete requestWithHelpers.setUrl;
    delete requestWithHelpers.getMethod;
    delete requestWithHelpers.setMethod;
    delete requestWithHelpers.getBody;
    delete requestWithHelpers.setBody;
    delete requestWithHelpers.proxy;
    delete requestWithHelpers.certificate;
    delete authWithUpdate.update;
    delete request.url;
    request.url = requestUrl;
    delete request.body;
    request.body = requestBody;
  }
  const hydratedRequest = await hydrateScriptFileReferences(request, fileReferences, options.readFile, fileBudget);
  return { request: hydratedRequest, environment, baseGlobals, baseGlobalDisabled, globalDisabled, collectionVariables, baseEnvironment, baseEnvironmentDisabled, collectionDisabled, folders, localVariables, logs, tests };
};
var executeHttp = async (request, variables, requestTimeoutMs = 3e4, proxyPreferences) => {
  if (request.protocol !== "http" && request.protocol !== "graphql") throw new Error(`CLI collection execution does not yet support ${request.protocol}.`);
  const url = buildRequestUrl(request, variables);
  const headers = buildHeaders(request, variables);
  const renderBody = (value) => request.renderBodyTemplates !== false ? resolveTemplate(value, variables) : value;
  let body;
  if (request.protocol === "graphql") {
    body = JSON.stringify({ query: request.graphql.query, variables: JSON.parse(renderBody(request.graphql.variables || "{}")), operationName: request.graphql.operationName || void 0 });
    if (!headers.some((header) => header.name.toLowerCase() === "content-type")) headers.push({ id: "cli-graphql", name: "Content-Type", value: "application/json", enabled: true });
  } else if (request.bodyMode === "json" || request.bodyMode === "text") body = renderBody(request.body);
  else if (request.bodyMode === "form-urlencoded") body = new URLSearchParams(request.formBody.filter((row) => row.enabled).map((row) => [renderBody(row.name), renderBody(row.value)]));
  else if (request.bodyMode === "multipart") {
    const form = new FormData();
    request.multipartBody.filter((part) => part.enabled && part.name).forEach((part) => {
      if (part.kind === "file" && part.file) {
        form.append(renderBody(part.name), new Blob([Buffer.from(part.file.dataBase64, "base64")], { type: renderBody(part.contentType || part.file.mimeType) }), renderBody(part.fileName || part.file.fileName));
      } else {
        form.append(renderBody(part.name), renderBody(part.value));
      }
    });
    body = form;
  } else if (request.bodyMode === "binary" && request.binaryBody) {
    body = Buffer.from(request.binaryBody.dataBase64, "base64");
    if (!headers.some((header) => header.enabled && header.name.toLowerCase() === "content-type")) headers.push({ id: "cli-binary", name: "Content-Type", value: request.binaryBody.mimeType, enabled: true });
  }
  const started = performance.now();
  const timeoutMs = resolveRequestTimeout(request.transport, requestTimeoutMs);
  if (resolveProxyTransport(request.transport, url, proxyPreferences).proxyMode === "custom") {
    throw new Error("The CLI cannot use a manual proxy because Node Fetch does not expose per-request proxy configuration. Use the native desktop transport or configure a supported runner-level proxy.");
  }
  const response = await fetch(url, {
    method: request.method,
    headers: Object.fromEntries(headers.filter((header) => header.enabled && header.name).map((header) => [header.name, header.value])),
    body: request.method === "GET" || request.method === "HEAD" ? void 0 : body,
    redirect: request.transport.followRedirects ? "follow" : "manual",
    signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : void 0
  });
  const responseBody = await response.text();
  return { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), body: responseBody, durationMs: Math.round(performance.now() - started), sizeBytes: Buffer.byteLength(responseBody), requestUrl: url };
};
var usage = `Brunomnia CLI

  brunomnia lint spec <openapi-file> [--ruleset <spectral-yaml>] [--json]
  brunomnia generate collection <openapi-file> --output <file>
  brunomnia export spec <workspace> <design-name-or-id> [--output <file>]
  brunomnia run collection <workspace> <collection-name-or-id> [--env <name-or-id>] [--iterations N] [--retries N] [--data <json-or-csv>] [--bail] [--reporter <name>] [--output <file>] [--allow-scripts] [--allow-script-requests] [--allow-script-files]
  brunomnia run test <workspace> <collection-name-or-id> [-t, --testNamePattern <regex>] [same options]

Reporters: dot, list, min, progress, spec, tap, json, junit
`;
var main = async () => {
  const [command, subject] = args;
  if (!command || hasFlag("--help") || hasFlag("-h")) {
    console.log(usage);
    return;
  }
  if (command === "lint" && subject === "spec") {
    const path = args[2] ?? fail("Provide an OpenAPI file.");
    const rulesetPath = flag("--ruleset");
    const analysis = analyzeOpenApi(await loadText(path), rulesetPath ? await loadText(rulesetPath) : "");
    if (hasFlag("--json")) console.log(JSON.stringify(analysis.issues, null, 2));
    else analysis.issues.forEach((issue) => console.log(`${issue.severity.toUpperCase()} ${issue.path}: ${issue.message}`));
    console.log(`${analysis.operations.length} operations \xB7 ${analysis.issues.length} issues`);
    if (analysis.issues.some((issue) => issue.severity === "error")) process.exitCode = 1;
    return;
  }
  if (command === "generate" && subject === "collection") {
    const path = args[2] ?? fail("Provide an OpenAPI file.");
    const output = flag("--output") ?? fail("Provide --output <file>.");
    const design = { id: "cli-design", name: path, contents: await loadText(path) };
    await (0, import_promises.writeFile)(output, `${JSON.stringify(generateCollectionFromOpenApi(design), null, 2)}
`);
    console.log(`Generated ${output}`);
    return;
  }
  if (command === "export" && subject === "spec") {
    const workspace = await loadWorkspace(args[2] ?? fail("Provide a workspace file."));
    const identifier = args[3] ?? fail("Provide a design name or ID.");
    const design = workspace.apiDesigns.find((candidate) => candidate.id === identifier || candidate.name === identifier) ?? fail(`Design '${identifier}' was not found.`);
    const output = flag("--output");
    if (output) {
      await (0, import_promises.writeFile)(output, design.contents);
      console.log(`Exported ${output}`);
    } else console.log(design.contents);
    return;
  }
  if (command === "run" && (subject === "collection" || subject === "test")) {
    const workspace = await loadWorkspace(args[2] ?? fail("Provide a workspace file."));
    const identifier = args[3] ?? fail("Provide a collection name or ID.");
    const collection2 = workspace.collections.find((candidate) => candidate.id === identifier || candidate.name === identifier) ?? fail(`Collection '${identifier}' was not found.`);
    const environmentIdentifier = flag("--env") ?? workspace.activeEnvironmentId;
    const selectedEnvironment = workspace.environments.find((candidate) => candidate.id === environmentIdentifier || candidate.name === environmentIdentifier) ?? workspace.environments[0] ?? fail("The workspace has no environment.");
    const environment = resolveEnvironment(workspace.environments, selectedEnvironment.id) ?? selectedEnvironment;
    const dataPath = flag("--data");
    const requestedTestNamePattern = flag("--testNamePattern") ?? flag("-t") ?? flag("--test-name-pattern");
    if (subject === "collection" && requestedTestNamePattern !== void 0) fail("--testNamePattern is only available for run test.");
    const testNamePattern = subject === "test" ? validateTestNamePattern(requestedTestNamePattern) : void 0;
    const executeWorkspaceHttp = (request, variables) => {
      const validateCertificates = workspace.preferences.validateCertificates;
      if (!resolveCertificateValidation(request.transport, validateCertificates)) {
        throw new Error("The CLI cannot disable TLS certificate validation because Node Fetch does not expose that authority. Use the native desktop transport for explicitly untrusted development certificates.");
      }
      return executeHttp(request, variables, workspace.preferences.requestTimeoutMs, {
        enabled: workspace.preferences.proxyEnabled,
        httpProxy: workspace.preferences.httpProxy,
        httpsProxy: workspace.preferences.httpsProxy,
        noProxy: workspace.preferences.noProxy
      });
    };
    const report = await runCollection(collection2, environment, {
      iterations: Number(flag("--iterations") ?? 1),
      retries: Number(flag("--retries") ?? 0),
      bail: hasFlag("--bail"),
      delayMs: 0,
      testNamePattern,
      scriptTimeoutMs: Math.min(6e4, Math.max(1e3, Number(flag("--script-timeout") ?? 1e4))),
      environmentScopes: scriptEnvironmentScopes(workspace.environments, selectedEnvironment.id),
      dataRows: dataPath ? parseRunnerData(await loadText(dataPath)) : []
    }, executeWorkspaceHttp, (source, request, variables, response, timeoutMs, localVariables, iterationData, scriptOptions) => {
      if (source.trim() && !hasFlag("--allow-scripts")) throw new Error("CLI script execution is disabled. Re-run trusted workspaces with --allow-scripts.");
      return runNodeScript(source, request, variables, response, timeoutMs, localVariables, iterationData, {
        ...scriptOptions,
        sendRequest: hasFlag("--allow-script-requests") ? executeWorkspaceHttp : void 0,
        readFile: hasFlag("--allow-script-files") ? readCliScriptFile : void 0
      });
    });
    const reporter = parseRunnerReporter(flag("--reporter") ?? flag("-r"), subject === "test" ? "spec" : "json");
    const artifact = createRunnerReportArtifact(report, reporter);
    const output = flag("--output") ?? flag("-o");
    if (output) {
      await (0, import_promises.writeFile)(output, artifact.contents);
      console.log(`Wrote ${reporter} report to ${output}`);
    } else {
      process.stdout.write(artifact.contents);
    }
    if (report.failed > 0) process.exitCode = 1;
    return;
  }
  fail(`Unknown command.

${usage}`);
};
void main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
