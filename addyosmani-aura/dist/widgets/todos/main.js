
define('todos_models/todo',['sandbox'], function(sandbox) {
  "use strict";

  var TodoModel = sandbox.mvc.Model({

    // Default attributes for the todo.
    defaults: {
      title: '',
      completed: false
    },

    // Ensure that each todo created has `title`.
    initialize: function() {
      if (!this.get('title')) {
        this.set({
          'title': this.defaults.title
        });
      }
    },

    // Toggle the `completed` state of this todo item.
    toggle: function() {
      this.save({
        completed: !this.get('completed')
      });
    },

    // Remove this Todo from *localStorage*.
    clear: function() {
      this.destroy();
    }

  });

  return TodoModel;

});

define('todos_collections/todos',['sandbox', 'todos_models/todo'], function(sandbox, Todo) {
  "use strict";

  var TodosCollection = sandbox.mvc.Collection({

    // Reference to this collection's model.
    model: Todo,

    // Save all of the todo items under the `'todos'` namespace.
    localStorage: new sandbox.data.Store('todos-backbone-require'),

    // Filter down the list of all todo items that are finished.
    completed: function() {
      return this.filter(function(todo) {
        return todo.get('completed');
      });
    },

    // Filter down the list to only todo items that are still not finished.
    remaining: function() {
      return this.without.apply(this, this.completed());
    },

    // We keep the Todos in sequential order, despite being saved by unordered
    // GUID in the database. This generates the next order number for new items.
    nextOrder: function() {
      if (!this.length) {
        return 1;
      }
      return this.last().get('order') + 1;
    },

    // Todos are sorted by their original insertion order.
    comparator: function(todo) {
      return todo.get('order');
    }
  });

  return new TodosCollection();

});

/**
 * @license RequireJS text 2.0.1 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, window: false, process: false, Packages: false,
  java: false, location: false */

define('text',['module'], function (module) {
    'use strict';

    var progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = [],
        masterConfig = (module.config && module.config()) || {},
        text, fs;

    text = {
        version: '2.0.1',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var strip = false, index = name.indexOf("."),
                modName = name.substring(0, index),
                ext = name.substring(index + 1, name.length);

            index = ext.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = ext.substring(index + 1, ext.length);
                strip = strip === "strip";
                ext = ext.substring(0, index);
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var match = text.xdRegExp.exec(url),
                uProtocol, uHostName, uPort;
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName + '.' + parsed.ext,
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                nonStripName = parsed.moduleName + '.' + parsed.ext,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + '.' +
                                     parsed.ext) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (typeof process !== "undefined" &&
             process.versions &&
             !!process.versions.node) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback) {
            var file = fs.readFileSync(url, 'utf8');
            //Remove BOM (Byte Mark Order) from utf8 files if it is there.
            if (file.indexOf('\uFEFF') === 0) {
                file = file.substring(1);
            }
            callback(file);
        };
    } else if (text.createXhr()) {
        text.get = function (url, callback, errback) {
            var xhr = text.createXhr();
            xhr.open('GET', url, true);

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        errback(err);
                    } else {
                        callback(xhr.responseText);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (typeof Packages !== 'undefined') {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                stringBuffer, line,
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                stringBuffer.append(line);

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    }

    return text;
});
define('text!todos_templates/todos.html',[],function () { return '<div class="<%= completed ? \'completed\' : \'\' %>">\n  <div class="view">\n    <input class="toggle" type="checkbox" <%= completed ? \'checked\' : \'\' %>>\n    <label><%= title %></label>\n    <button class="destroy"></button>\n  </div>\n  <input class="edit" value="<%= title %>">\n</div>\n';});

define('todos_views/todos',['sandbox', 'text!todos_templates/todos.html'], function(sandbox, todosTemplate) {
  "use strict";

  return sandbox.mvc.View({

    //... is a list tag.
    tagName: 'li',

    // Cache the template function for a single item.
    template: sandbox.template.parse(todosTemplate),

    // The DOM events specific to an item.
    events: {
      'click .toggle': 'toggleCompleted',
      'dblclick .view': 'edit',
      'click .destroy': 'clear',
      'keypress .edit': 'updateOnEnter',
      'blur .edit': 'close'
    },

    // The TodoView listens for changes to its model, re-rendering. Since there's
    // a one-to-one correspondence between a **Todo** and a **TodoView** in this
    // app, we set a direct reference on the model for convenience.
    initialize: function() {
      this.model.bind('change', this.render, this);
      this.model.bind('destroy', this.remove, this);
    },

    // Re-render the contents of the todo item.
    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      this.input = this.$('.edit');
      return this;
    },

    // Toggle the `'completed'` state of the model.
    toggleCompleted: function() {
      this.model.toggle();
    },

    // Switch this view into `editing` mode, displaying the input field.
    edit: function() {
      // sandbox.dom.find(this.el).addClass('editing');
      this.$el.addClass('editing');
      this.input.focus();
    },

    // Close the `editing` mode, saving changes to the todo.
    close: function() {
      var value = this.input.val();

      if (!value) {
        this.clear();
      }
      this.model.save({
        title: value
      });
      this.$el.removeClass('editing');
    },

    // If you hit `enter`, we're through editing the item.
    updateOnEnter: function(e) {
      if (e.keyCode === 13) {
        this.close();
      }
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.clear();
    }
  });

});

define('text!todos_templates/base.html',[],function () { return '<div class="widget">\n  <header id="header">\n    <input id="new-todo" placeholder="What needs to be done?">\n  </header>\n  <section id="main">\n    <input id="toggle-all" type="checkbox">\n    <label for="toggle-all">Mark all as complete</label>\n    <ul id="todo-list"></ul>\n  </section>\n  <footer id="footer"></footer>\n</div>\n';});

define('text!todos_templates/stats.html',[],function () { return '<% if (total) { %>\n  <span id="todo-count">\n    <strong class="number"><%= remaining %></strong>\n    <span class="word"><%= remaining == 1 ? \'item\' : \'items\' %></span> left\n  </span>\n<% } %>\n<% if (completed) { %>\n  <button id="clear-completed">\n    Clear completed <span class="number-done">(<%= completed %>)</span>\n  </button>\n<% } %>\n\n';});

define('todos_views/app',['sandbox', 'todos_collections/todos', 'todos_views/todos', 'text!todos_templates/base.html', 'text!todos_templates/stats.html'], function(sandbox, Todos, TodoView, baseTemplate, statsTemplate) {
  "use strict";

  var AppView = sandbox.mvc.View({

    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    // el: sandbox.dom.find('#todoapp'),
    // Our base for the rest of the Todos widget
    baseTemplate: sandbox.template.parse(baseTemplate),

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: sandbox.template.parse(statsTemplate),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      'keypress #new-todo': 'createOnEnter',
      'click #clear-completed': 'clearCompleted',
      'click #toggle-all': 'toggleAllComplete'
    },

    // At initialization we bind to the relevant events on the `Todos`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting todos that might be saved in *localStorage*.
    initialize: function() {
      this.$el.html(baseTemplate);
      this.input = this.$('#new-todo');
      this.allCheckbox = this.$('#toggle-all')[0];

      Todos.bind('add', this.addOne, this);
      Todos.bind('reset', this.addAll, this);
      Todos.bind('all', this.render, this);
      sandbox.subscribe('new-event', 'todos', this.addEvent);

      Todos.fetch();
    },
    addEvent: function(object) {
      Todos.create({
        title: object.title,
        order: Todos.nextOrder(),
        completed: false
      });
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      var completed = Todos.completed().length;
      var remaining = Todos.remaining().length;

      this.$('#footer').html(this.statsTemplate({
        total: Todos.length,
        completed: completed,
        remaining: remaining
      }));
      this.allCheckbox.checked = !remaining;
    },

    // Add a single todo item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(todo) {
      var view = new TodoView({
        model: todo
      });
      this.$('#todo-list').append(view.render().el);
    },

    // Add all items in the **Todos** collection at once.
    addAll: function() {
      Todos.each(this.addOne.bind(this));
    },

    // Generate the attributes for a new Todo item.
    newAttributes: function() {
      return {
        title: this.input.val(),
        order: Todos.nextOrder(),
        completed: false
      };
    },

    // If you hit return in the main input field, create new **Todo** model,
    // persisting it to *localStorage*.
    createOnEnter: function(e) {
      if (e.keyCode !== 13) {
        return;
      }
      if (!this.input.val()) {
        return;
      }

      Todos.create(this.newAttributes());
      this.input.val('');
    },

    // Clear all compelted todo items, destroying their models.
    clearCompleted: function() {
      sandbox.util.each(Todos.completed(), function(todo) {
        todo.clear();
      });

      return false;
    },

    // Change each todo so that it's `completed` state matches the check all
    toggleAllComplete: function() {
      var completed = this.allCheckbox.checked;

      Todos.each(function(todo) {
        todo.save({
          'completed': completed
        });
      });
    }
  });

  return AppView;

});

define('../../../widgets/todos/main',['sandbox', 'todos_views/app'], function(sandbox, AppView) {
  "use strict";

  return function(element) {
    new AppView({
      el: sandbox.dom.find(element)
    });

    sandbox.publish('bootstrap', 'todos');
    sandbox.subscribe('bootstrap', 'todos', function(from) {
      console.log('Todos-bootstrap message from from: ' + from);
    });
  };

});
