###*
#
#
#
# Methods
#   - attr(attr: string)
#       指定したプロパティの値を取得します。
#   - isDefaultList(): boolean
#       このリストが"とりあえずマイリスト"か判定します。
#   - getInterface(): MyList
#       現在のインスタンスのマイリストと対応するMyListインスタンスを取得します。
#   - toJSON(): Object
#       インスタンスのプロパティを複製します。
#
# Events
#   (none)
#
# Properties
#   attrメソッドを介して取得します。（とりあえずマイリストの場合,idとname以外設定されません。）
#       Example. mylist.attr("id") // -> マイリストIDを取得
###
_ = require "lodash"
__ = require "lodash-deep"
MyList = require "./MyList"

###*
# マイリストのメタデータを表すクラスです。
# このモデルからマイリストを操作することはできません。
# @class MyListMeta
###
module.exports =
class MyListMeta
    @defaults :
        id          : -1
        name        : null
        description : null
        public      : null
        iconId      : -1
        defaultSort : -1
        sortOrder   : -1
        userId      : -1
        createTime  : null
        updateTime  : null

    ###*
    # @param {Object}   metaInfo    Result of mylistgroup/list API
    ###
    @instance : (metaInfo) ->
        meta = new MyListMeta
        meta._attr = MyListMeta.parse(metaInfo)

        Object.defineProperties meta,
            id :
                value : meta.get("id")

        meta

    ###*
    # @param {Object}   metaInfo    Result of mylistgroup/list API
    ###
    @parse : (metaInfo) ->
        if metaInfo is "home"
            attr = _.defaults
                id: "home"
                name: "とりあえずマイリスト"
                public : false
            , MyListMeta.defaults

            return attr

        attr = _.defaults
            id          : metaInfo.id | 0
            name        : metaInfo.name
            description : metaInfo.description
            public      : (metaInfo.public | 0) is 1
            iconId      : metaInfo.icon_id | 0
            defaultSort : metaInfo.default_sort | 0
            sortOrder   : metaInfo.sort_order | 0
            userId      : metaInfo.user_id | 0
            createTime  : new Date(metaInfo.create_time * 1000)
            updateTime  : new Date(metaInfo.update_time * 1000)
        , MyListMeta.defaults

        attr

    ###*
    # @private
    # @property {String|Number}     _id
    ###
    _id : null

    ###*
    # @private
    # @property {Number}    _attributes.id              マイリストID
    # @property {String}    _attributes.description     マイリストの説明
    # @property {Number}    _attributes.userId          ユーザー番号
    # @property {Number}    _attributes.defaultSort     標準のソート方法（？）
    # @property {Number}    _attributes.sortOrder       ソート方式（？）
    # @property {Number}    _attributes.iconId          マイリストのアイコンID
    # @property {String}    _attributes.name            リスト名
    # @property {Boolean}   _attributes.public          公開マイリストかどうか
    # @property {Date}      _attributes.createTime      マイリストの作成日
    # @property {Date}      _attributes.updateTime      マイリストの更新日
    ###
    _attr : null


    ###*
    # 指定したプロパティの値を取得します。
    # @param {string} attr プロパティ名
    ###
    get             : (attr) ->
        return __.deepGet(@_attr, attr)


    ###*
    # このマイリストが"とりあえずマイリスト"か検証します。
    # @return {boolean}
    #   "とりあえずマイリスト"ならtrueを返します。
    ###
    isDefaultList   : ->
        @attr("id") is "home"


    ###*
    # オブジェクトと対応するMyListインスタンスを取得します。
    # @return {Promise}
    ###
    getMyList  : ->
        return new MyList @get("id")


    ###*
    # インスタンスのプロパティを複製します。
    # @return {Object}
    ###
    toJSON          : ->
        return _.clone @_attr
