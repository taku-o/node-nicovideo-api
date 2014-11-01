// Generated by CoffeeScript 1.8.0

/**
 * ひとつのリストを表すのモデルです。
 * このモデルからマイリストを操作することはできません。
 *
 * Methods
 *   - attr(attr: string)
 *       指定したプロパティの値を取得します。
 *   - isDefaultList(): boolean
 *       このリストが"とりあえずマイリスト"か判定します。
 *   - getInterface(): MyList
 *       現在のインスタンスのマイリストと対応するMyListインスタンスを取得します。
 *   - toJSON(): Object
 *       インスタンスのプロパティを複製します。
 *
 * Events
 *   (none)
 *
 * Properties
 *   attrメソッドを介して取得します。（とりあえずマイリストの場合,idとname以外設定されません。）
 *       Example. mylist.attr("id") // -> マイリストIDを取得
 *
 *   - id            : number    -- マイリストID
 *   - name          : string    -- リスト名
 *   - description   : string    -- マイリストの説明
 *   - public        : boolean   -- 公開マイリストかどうか
 *   - iconId        : number    -- マイリストのアイコンID
 *   - defaultSort   : number    -- 標準のソート方法（？）
 *   - sortOrder     : number    -- ソート方式（？）
 *   - userId        : number    -- ユーザー番号
 *   - createTime    : Date      -- マイリストの作成日
 *   - updateTime    : Date      -- マイリストの更新日
 */

(function() {
  var Backbone, MyList, MyListMeta, _,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  _ = require("underscore");

  Backbone = require("backbone");

  MyList = require("./MyList");

  MyListMeta = (function(_super) {
    __extends(MyListMeta, _super);

    MyListMeta.prototype.defaults = {
      id: -1,
      name: null,
      description: null,
      "public": null,
      iconId: -1,
      defaultSort: -1,
      sortOrder: -1,
      userId: -1,
      createTime: null,
      updateTime: null
    };


    /**
     *
     */

    MyListMeta.prototype._attributes = null;


    /**
     * @type {NicoMyListApi}
     */

    MyListMeta.prototype._api = null;


    /**
     * マイリストのメタ情報を保存しているモデル
     * @param {Object} groupInfo
     *   マイリスト情報（MylistAPI形式）
     * @param {function(OmittedMyListGroup)} fnGetMyListGroup
     *   MyListGroupインスタンスを取得するための関数。
     * @constructor
     */

    function MyListMeta(metaInfo, mylistApi) {
      var attr;
      if (metaInfo) {
        attr = _.defaults({
          id: metaInfo.id | 0,
          name: metaInfo.name,
          description: metaInfo.description,
          "public": (metaInfo["public"] | 0) === 1,
          iconId: metaInfo.icon_id | 0,
          defaultSort: metaInfo.default_sort | 0,
          sortOrder: metaInfo.sort_order | 0,
          userId: metaInfo.user_id | 0,
          createTime: new Date(metaInfo.create_time * 1000),
          updateTime: new Date(metaInfo.update_time * 1000)
        }, this.defaults);
      } else {
        attr = _.defaults({
          id: "default",
          name: "とりあえずマイリスト"
        }, this.defaults);
      }
      this._attributes = attr;
      this.id = attr.id;
      this._api = mylistApi;
    }


    /**
     * 指定したプロパティの値を取得します。
     * @param {string} attr プロパティ名
     */

    MyListMeta.prototype.get = function(attr) {
      return this._attributes[attr];
    };


    /**
     * このマイリストが"とりあえずマイリスト"か検証します。
     * @return {boolean}
     *   "とりあえずマイリスト"ならtrueを返します。
     */

    MyListMeta.prototype.isDefaultList = function() {
      return this.attr("id") === "default";
    };


    /**
     * オブジェクトと対応するMyListインスタンスを取得します。
     * @return {Promise}
     */

    MyListMeta.prototype.getMyList = function() {
      return new MyList(this.attr("id"));
    };


    /**
     * インスタンスのプロパティを複製します。
     * @return {Object}
     */

    MyListMeta.prototype.toJSON = function() {
      return _.clone(this._attributes);
    };

    return MyListMeta;

  })(Backbone.Model);

  module.exports = MyListMeta;

}).call(this);