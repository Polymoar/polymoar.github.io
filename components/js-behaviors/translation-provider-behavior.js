(function(){
    'use strict';

    window.JS = window.JS || {};

    var langRegExp = /^([A-Za-z]*)-[A-Za-z]*$/gi, //regular expression for navigator language descriptors
        i18n = {}; //cache for fetched translations


    /**
     * `JS.TranslationProviderBehavior` allows to use `$t` property as binding provider for translation fetched from json files in i18n directory.
     * It also provides possibility to synchronise translation with children extending `JS.TranslationReceiverBehavior`.
     * If provider is a child of another provider it will treat its translation as a prototype for own translation.
     * Provider synchronises language with `$c.lang` context property therefore it also extends `JS.ContextReceiverBehavior`.
     *
     * Translation files should be named {element.is}\_{ln}-{LN}.json or {element.is}\_{ln}.json.
     * @polymerBehavior JS.TranslationProviderBehavior
     */
    JS.TranslationProviderBehaviorImpl = {
        properties: {
            /**
             * Directory from which the translations will be fetched. If element is extending `JS.Settings{Provider|Receiver}Behavior` it will default to `$s.i18n`.
             * @default 'i18n/'
             */
            $tUrl: {
                type: String,
                value(){ return this.$s && this.$s.i18n || 'i18n/'; }
            },
            /**
             * Default language for translation. If element is extending `JS.Settings{Provider|Receiver}Behavior` it will default to `$s.defaultLang`.
             * @default 'en'
             */
            $tDefaultLang: {
                type: String,
                value(){ return this.$s && this.$s.defaultLang || 'en'; }
            },
            _$tBaseListeners: {
                type: Array,
                value(){ return []; }
            },
            _$tListeners: {
                type: Array,
                value(){ return []; }
            },
            _$tRequest: {
                type: Object,
                computed: '_$tGetTranslation($c.lang)'
            },
            _$tBase: {
                type: Object,
                value(){ return {}; }
            },
            _$t: {
                type: Object,
                value(){ return {}; }
            },
            /**
             * Object containing fetched translation.
             */
            $t: {
                type: Object,
                value(){ return {}; }
            }
        },
        observers: [
            '_$tTranslate(_$tBase, _$t)'
        ],
        listeners: {
            'translation-required': '_$tRegisterElement',
            'translation-released': '_$tUnregisterElement'
        },
        attached(){
            /**
             * Fired when element is attached. Subscribes base translation to parent provider if exists
             * @event translation-required
             */
            this.fire('translation-required', { base: this });
        },
        detached(){
            /**
             * Fired when element is detached. Unsubscribes from parent translation provider
             * @event translation-released
             */
            this.fire('translation-released', { base: this });
        },
        //Method registering elements that require translation
        _$tRegisterElement: function registerElement(e){
            var detail = e.detail,
                element = detail.target || detail.base,
                array = detail.target ? this._$tListeners : this._$tBaseListeners;
            if(element !== this){
                e.stopPropagation();
                array.push(element);
            }
        },
        //Method unregistering elements that no longer require translation
        _$tUnregisterElement: function unregisterElement(e){
            var detail = e.detail,
                element = detail.target || detail.base,
                array = detail.target ? this._$tListeners : this._$tBaseListeners,
                index = array.indexOf(element);
            array.splice(index, 1);
        },
        //Method acquiring translation
        _$tGetTranslation: function getTranslation(lang, handleOnFail){
            var descriptor = [this.is, '_', lang].join('');
            if(i18n[descriptor]){
                return new Promise((resolve) => {
                    this.set('_$t', i18n[descriptor]);
                    this.async(() => resolve(i18n[descriptor]));
                });
            }else{
                return new Promise((resolve, reject) => {
                    this.async(() => {
                        this.$http.get([this.$tUrl, descriptor, '.json'].join('')).then((res) => {
                            this.set('_$t', res);
                            i18n[[this.is, '_', this.$c.lang].join('')] = res;
                            resolve(res);
                        }, () => {
                            var match = langRegExp.exec(lang);
                            if(match){
                                getTranslation.call(this, match[1]).then(resolve, reject);
                            }else if(!handleOnFail){
                                getTranslation.call(this, this.$tDefaultLang, true).then(resolve, reject);
                            }else{
                                reject(new Error('Failed to load translation file for ' + this.is));
                            }
                        });
                    });
                });
            }
        },
        //Method performing translation
        _$tTranslate: function translate(_$tBase, _$t){
            return new Promise((resolve) => {
                //constructor for translation object
                function Translation(json){
                    for(var key in json){
                        this[key] = json[key];
                    }
                }
                //prototype assignment
                Translation.prototype = _$tBase;
                var translation = new Translation(_$t);
                this._$tBaseListeners.forEach((val) => {
                    val.set('_$tBase', translation);
                });
                this._$tListeners.forEach((val) => {
                    val.set('$t', translation);
                });
                //bind translation
                this.set('$t', translation);
                resolve(translation);
            });
        }
    };
    JS.TranslationProviderBehavior = [JS.AjaxBehavior, JS.ContextReceiverBehavior, JS.TranslationProviderBehaviorImpl];

})();
