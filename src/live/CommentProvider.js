/**
 * 放送中の番組のコメントの取得と投稿を行うクラスです。
 * @class CommentProvider
 */

let CommentProvider;
const _ = require("lodash");
const Cheerio = require("cheerio");
const deepFreeze = require("deep-freeze");
const Request = require("request-promise");
const Deferred = require("promise-native-deferred");
const {Socket} = require("net");
const {sprintf} = require("sprintf");

const Emitter = require("disposable-emitter");
const NicoUrl     = require("../NicoURL");
const NicoException = require("../NicoException");
const NicoLiveComment = require("./NicoLiveComment");


const chatResults = deepFreeze({
    SUCCESS             : 0,
    CONTINUOUS_POST     : 1,
    THREAD_ID_ERROR     : 2,
    TICKET_ERROR        : 3,
    DIFFERENT_POSTKEY   : 4,
    _DIFFERENT_POSTKEY  : 8,
    LOCKED              : 5
});


const COMMANDS = {
    connect : _.template(`\
<thread thread="<%- thread %>" version="20061206"
 res_from="-<%- firstGetComments %>"/>\
`
    ),
    post    : _.template(`\
<chat thread="<%-threadId%>" ticket="<%-ticket%>"
 postkey="<%-postKey%>" mail="<%-command%>" user_id="<%-userId%>"
 premium="<%-isPremium%>"><%-comment%></chat>\
`
    )
};

module.exports =
(CommentProvider = (function() {
    CommentProvider = class CommentProvider extends Emitter {
        static initClass() {
            this.ChatResult  = chatResults;
    
            /**
             * @private
             * @propery {NicoLiveInfo} _live
             */
            this.prototype._live        = null;
    
            /**
             * @private
             * @propery {net.Socket} _socket
             */
            this.prototype._socket  = null;
    
            /**
             * @private
             * @propery {Object} _postInfo
             */
            this.prototype._postInfo    = null;
                // ticket      : null
                // postKey     : null
                // threadId    : null
    
            /**
             * @property {Boolean} isFirstResponseProsessed
             */
            this.prototype.isFirstResponseProsessed  = false;
        }

        /**
         * @param {NicoLiveInfo} liveInfo
         * @return {Promise}
         */
        static instanceFor(liveInfo) {
            if (liveInfo == null) {
                throw new TypeError("liveInfo must be instance of NicoLiveInfo");
            }

            return Promise.resolve(new CommentProvider(liveInfo));
        }

        /**
         * @constructor
         * @param {NicoLiveInfo} _live
         */
        constructor(_live) {
            {
              // Hack: trick babel into allowing this before super.
              if (false) { super(); }
              let thisFn = (() => { this; }).toString();
              let thisName = thisFn.slice(thisFn.indexOf('{') + 1, thisFn.indexOf(';')).trim();
              eval(`${thisName} = this;`);
            }
            this._live = _live;
            super(...arguments);

            this.isFirstResponseProsessed = false;
            this._postInfo  = {
                ticket : null,
                postKey : null,
                threadId : null
            };
        }


        /**
         * このインスタンスが保持しているNicoLiveInfoオブジェクトを取得します。
         * @method getLiveInfo
         * @return {NicoLiveInfo}
         */
        getLiveInfo() {
            return this._live;
        }


        /**
         * @private
         * @method _canContinue
         */
        _canContinue() {
            if (this.disposed) {
                throw new Error("CommentProvider has been disposed");
            }
        }


        /**
         * [Method for testing] Stream given xml data as socket received data.
         * @private
         * @method _pourXMLData
         * @param {String} xml
         */
        _pourXMLData(xml) {
            return this._didReceiveData(xml);
        }


        /**
         * コメントサーバーへ接続します。
         *
         * 既に接続済みの場合は接続を行いません。
         * 再接続する場合は `CommentProvider#reconnect`を利用してください。
         *
         * @method connect
         * @fires CommentProvider#did-connect
         * @param {Object} [options]
         * @param {Number} [options.firstGetComments=100] 接続時に取得するコメント数
         * @param {Number} [options.timeoutMs=5000] タイムアウトまでのミリ秒
         * @return {Promise}
         */
        connect(options) {
            if (options == null) { options = {}; }
            this._canContinue();

            if (this._socket != null) { return Promise.resolve(this); }

            const serverInfo  = this._live.get("comment");
            options = _.defaults({}, options, {
                firstGetComments: 100,
                timeoutMs : 5000
            }
            );

            return new Promise((function(resolve, reject) {
                let timerId = null;
                this._socket = new Socket;

                // @once "receive", @_threadInfoDetector

                this._socket
                .once("connect", () => {
                    this.once("_did-receive-connection-response", () => {
                        clearTimeout(timerId);
                        resolve(this);
                    }
                    );

                    // Send thread information
                    const params = _.assign({}, {firstGetComments: options.firstGetComments}, serverInfo);
                    this._socket.write(COMMANDS.connect(params) + '\0');

                    
                }).on("data", this._didReceiveData.bind(this))

                .on("error", this._didErrorOnSocket.bind(this))

                .on("close", this._didCloseSocket.bind(this));

                this._socket.connect({
                    host : serverInfo.addr,
                    port : serverInfo.port
                });

                return timerId = setTimeout(() => {
                    reject(new Error(`[CommentProvider: ${this._live.id}] Connection timed out.`));
                }
                , options.timeoutMs);
            }.bind(this)));
        }


        /**
         * @method reconnect
         * @param {Object} options 接続設定（connectメソッドと同じ）
         * @return {Promise}
         */
        reconnect(options) {
            this._canContinue();

            if (this._socket != null) { this._socket.destroy(); }
            this._socket = null;
            return this.connect();
        }


        /**
         * コメントサーバから切断します。
         * @method disconnect
         * @fires CommentProvider#did-disconnect
         *///
        disconnect() {
            this._canContinue();

            if (this._socket == null) { return; }

            this._socket.removeAllListeners();
            this._socket.destroy();
            this._socket = null;
            this.emit("did-close-connection");
        }


        /**
         * APIからpostkeyを取得します。
         * @private
         * @method _ferchPostKey
         * @return {Promise}
         */
        _fetchPostKey() {
            this._canContinue();

            const threadId    = this._live.get("comment.thread");
            const url         = sprintf(NicoUrl.Live.GET_POSTKEY, threadId);
            let postKey     = "";

            // retry = if _.isNumber(retry) then Math.min(Math.abs(retry), 5) else 5

            return Request.get({
                resolveWithFullResponse : true,
                url,
                jar : this._live._session.cookie}).then(res => {
                if (res.statusCode === 200) {
                    // 正常に通信できた時
                    postKey = /^postkey=(.*)\s*/.exec(res.body);
                    if (postKey != null) { postKey = postKey[1]; }
                }

                if (postKey !== "") {
                    // ポストキーがちゃんと取得できれば
                    this._postInfo.postKey = postKey;
                    return Promise.resolve(postKey);
                } else {
                    return Promise.reject(new Error("Failed to fetch post key"));
                }
            }
            );
        }


        /**
         * コメントを投稿します。
         * @method postComment
         * @param {String} msg 投稿するコメント
         * @param {String|Array.<String>} [command] コマンド(184, bigなど)
         * @param {Number} [timeoutMs]
         * @return {Promise}
         */
        postComment(msg, command, timeoutMs) {
            if (command == null) { command = ""; }
            if (timeoutMs == null) { timeoutMs = 3000; }
            this._canContinue();

            if ((typeof msg !== "string") || (msg.replace(/\s/g, "") === "")) {
                return Promise.reject(new Error("Can not post empty comment"));
            }

            if (this._socket == null) {
                return Promise.reject(new Error("No connected to the comment server."));
            }

            if (Array.isArray(command)) { command = command.join(" "); }

            return this._fetchPostKey().then(() => {
                const defer = new Deferred;
                let timerId = null;

                const postInfo = {
                    userId      : this._live.get("user.id"),
                    isPremium   : this._live.get("user.isPremium")|0,

                    comment     : msg,
                    command,

                    threadId    : this._postInfo.threadId,
                    postKey     : this._postInfo.postKey,
                    ticket      : this._postInfo.ticket
                };

                var disposer = this._onDidReceivePostResult(function({status}) {
                    disposer.dispose();
                    clearTimeout(timerId);

                    switch (status) {
                        case chatResults.SUCCESS:
                            defer.resolve();
                            break;

                        case chatResults.THREAD_ID_ERROR:
                            defer.reject(new NicoException({
                                message : "Failed to post comment. (reason: thread id error)",
                                code : status
                            })
                            );
                            break;

                        case chatResults.TICKET_ERROR:
                            defer.reject(new NicoException({
                                message : "Failed to post comment. (reason: ticket error)",
                                code : status
                            })
                            );
                            break;

                        case chatResults.DIFFERENT_POSTKEY: case chatResults._DIFFERENT_POSTKEY:
                            defer.reject(new NicoException({
                                message : "Failed to post comment. (reason: postkey is defferent)",
                                code : status
                            })
                            );
                            break;

                        case chatResults.LOCKED:
                            defer.reject(new NicoException({
                                message : "Your posting has been locked.",
                                code : status
                            })
                            );
                            break;

                        case chatResults.CONTINUOUS_POST:
                            defer.reject(new NicoException({
                                message : "Can not post continuous the same comment.",
                                code : status
                            })
                            );
                            break;

                        default:
                            defer.reject(new NicoException({
                                message : `Failed to post comment. (status: ${status})`,
                                code : status
                            })
                            );
                    }

                });


                timerId = setTimeout(function() {
                    disposer.dispose();
                    return defer.reject(new Error("Post result response is timed out."));
                }
                , timeoutMs);

                this._socket.write(COMMANDS.post(postInfo) + "\0");

                return defer.promise;
            }
            );
        }


        /**
         * インスタンスを破棄します。
         * @method dispose
         */
        dispose() {
            this._live = null;
            this._postInfo = null;
            this.disconnect();
            return super.dispose(...arguments);
        }


        //
        // Event Listeners
        //

        /**
         * コメント受信処理
         * @private
         * @method _didReceiveData
         * @param {String} xml
         */
        _didReceiveData(xml) {
            this.emit("did-receive-data", xml);

            const comments = [];

            const $elements = Cheerio.load(xml)(":root");
            $elements.each((i, element) => {
                const $element = Cheerio(element);

                switch (element.name) {
                    case "thread":
                        // Did receive first connection response
                        this._postInfo.ticket = $element.attr("ticket");
                        this.emit("_did-receive-connection-response");
                        break;
                        // console.info "CommentProvider[%s]: Receive thread info", @_live.get("id")

                    case "chat":
                        let comment = NicoLiveComment.fromRawXml($element.toString(), this._live.get("user.id"));
                        comments.push(comment);
                        this.emit("did-receive-comment", comment);

                        // 配信終了通知が来たら切断
                        if (comment.isPostByDistributor() && (comment.comment === "/disconnect")) {
                            this.emit("did-end-live", this._live);
                            this.disconnect();
                        }
                        break;

                    case "chat_result":
                        // Did receive post result
                        let status = $element.attr("status");
                        status = status | 0;

                        comment = NicoLiveComment.fromRawXml($element.find("chat").toString(), this._live.get("user.id"));
                        this.emit("did-receive-post-result", {status});
                        this.emit("did-receive-comment", comment);
                        break;
                }

            }
            );

            if (this.isFirstResponseProsessed === false) {
                this.isFirstResponseProsessed = true;
                this.lockAutoEmit("did-process-first-response", comments);
            }

        }


        /**
         * コネクション上のエラー処理
         * @private
         * @method _didErrorOnSocket
         */
        _didErrorOnSocket(error) {
            this.emit("did-error", error);
        }


        /**
         * コネクションが閉じられた時の処理
         * @private
         * @method _didCloseSocket
         */
        _didCloseSocket(hadError) {
            if (hadError) {
                this.emit("error", "Connection closing error (unknown)");
            }

            this.emit("did-close-connection");
        }


        /**
         * コメントサーバのスレッドID変更を監視するリスナ
         * @private
         * @method _didRefreshLiveInfo
         */
        _didRefreshLiveInfo() {
            // 時々threadIdが変わるのでその変化を監視
            this._postInfo.threadId = this._live.get("comment").thread;
        }


        //
        // Event Handlers
        //

        /**
         * @private
         * @event CommentProvider#did-receive-post-result
         * @param {Number} status
         */
        /**
         * @private
         * @method _onDidReceivePostResult
         * @param {Function} listener
         * @return {Disposable}
         */
        _onDidReceivePostResult(listener) {
            return this.on("did-receive-post-result", listener);
        }


        /**
         * Fire on received and processed thread info and comments first
         * @event CommentProvider#did-process-first-response
         * @param {Array.<NicoLiveComment>}
         */
        /**
         * @method onDidProcessFirstResponse
         * @param {Function} listener
         * @return {Disposable}
         */
        onDidProcessFirstResponse(listener) {
            return this.on("did-process-first-response", listener);
        }


        /**
         * Fire on raw response received
         * @event CommentProvider#did-receive-data
         * @params {String}  data
         */
        /**
         * @method onDidReceiveData
         * @param {Function} listener
         * @return {Disposable}
         */
        onDidReceiveData(listener) {
            return this.on("did-receive-data", listener);
        }


        /**
         * Fire on comment received
         * @event CommentProvider#did-receive-comment
         * @params {NicoLiveComment} comment
         */
        /**
         * @method onDidReceiveComment
         * @param {Function} listener
         * @return {Disposable}
         */
        onDidReceiveComment(listener) {
            return this.on("did-receive-comment", listener);
        }


        /**
         * Fire on error raised on Connection
         * @event CommentProvider#did-error
         * @params {Error} error
         */
        /**
         * @method onDidError
         * @param {Function} listener
         * @return {Disposable}
         */
        onDidError(listener) {
            return this.on("did-error", listener);
        }


        /**
         * Fire on connection closed
         * @event CommentProvider#did-close-connection
         */
        /**
         * @method onDidCloseConnection
         * @param {Function} listener
         * @return {Disposable}
         */
        onDidCloseConnection(listener) {
            return this.on("did-close-connection", listener);
        }


        /**
         * Fire on live  ended
         * @event CommentProvider#did-end-live
         */
        /**
         * @method onDidEndLive
         * @param {Function} listener
         * @return {Disposable}
         */
        onDidEndLive(listener) {
            return this.on("did-end-live", listener);
        }
    };
    CommentProvider.initClass();
    return CommentProvider;
})());
