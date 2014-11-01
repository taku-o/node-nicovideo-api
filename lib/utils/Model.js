// Generated by CoffeeScript 1.8.0
(function() {
  var Backbone, ExtendModel,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Backbone = require("backbone");

  ExtendModel = (function(_super) {
    __extends(ExtendModel, _super);

    function ExtendModel() {
      return ExtendModel.__super__.constructor.apply(this, arguments);
    }

    ExtendModel.prototype.get = function(key, def) {
      var cur, keys, pos;
      keys = key.split(".");
      cur = this.attributes;
      try {
        for (pos in keys) {
          cur = cur[pos];
        }
        return cur;
      } catch (_error) {
        return def;
      }
    };

    ExtendModel.prototype.set = function(key) {};

    return ExtendModel;

  })(Backbone.Model);

}).call(this);