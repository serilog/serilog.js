/**
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
 */
if (typeof Object.assign != 'function') {
  Object.assign = function (target, varArgs) {
    'use strict';
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var to = Object(target);

    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];

      if (nextSource != null) {
        for (var nextKey in nextSource) {
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}

/**
 * Represents the severity level of a log event.
 */
var LogEventLevel;
(function (LogEventLevel) {
    LogEventLevel[LogEventLevel["off"] = 0] = "off";
    LogEventLevel[LogEventLevel["fatal"] = 1] = "fatal";
    LogEventLevel[LogEventLevel["error"] = 3] = "error";
    LogEventLevel[LogEventLevel["warning"] = 7] = "warning";
    LogEventLevel[LogEventLevel["information"] = 15] = "information";
    LogEventLevel[LogEventLevel["debug"] = 31] = "debug";
    LogEventLevel[LogEventLevel["verbose"] = 63] = "verbose";
})(LogEventLevel || (LogEventLevel = {}));
/**
 * Checks if a log event level includes the target log event level.
 * @param {LogEventLevel} level The level to check.
 * @param {LogEventLevel} target The target level.
 * @returns True if the checked level contains the target level.
 */
function isEnabled(level, target) {
    return (level & target) === target;
}
/**
 * Represents a log event.
 */
class LogEvent {
    /**
     * Creates a new log event instance.
     */
    constructor(timestamp, level, messageTemplate, properties) {
        this.timestamp = timestamp;
        this.level = level;
        this.messageTemplate = messageTemplate;
        this.properties = properties || {};
    }
}

const tokenizer = /\{@?\w+}/g;
/**
 * Represents a message template that can be rendered into a log message.
 */
class MessageTemplate {
    /**
     * Creates a new MessageTemplate instance with the given template.
     */
    constructor(messageTemplate) {
        if (messageTemplate === null || !messageTemplate.length) {
            throw new Error('Argument "messageTemplate" is required.');
        }
        this.raw = messageTemplate;
        this.tokens = this.tokenize(messageTemplate);
    }
    /**
     * Renders this template using the given properties.
     * @param {Object} properties Object containing the properties.
     * @returns Rendered message.
     */
    render(properties) {
        if (!this.tokens.length) {
            return this.raw;
        }
        properties = properties || {};
        const result = [];
        for (var i = 0; i < this.tokens.length; ++i) {
            const token = this.tokens[i];
            if (typeof token.name === 'string') {
                if (properties.hasOwnProperty(token.name)) {
                    result.push(this.toText(properties[token.name]));
                }
                else {
                    result.push(token.raw);
                }
            }
            else {
                result.push(token.text);
            }
        }
        return result.join('');
    }
    /**
     * Binds the given set of args to their matching tokens.
     * @param {any} positionalArgs Arguments.
     * @returns Object containing the properties.
     */
    bindProperties(positionalArgs) {
        const result = {};
        let nextArg = 0;
        for (var i = 0; i < this.tokens.length && nextArg < positionalArgs.length; ++i) {
            const token = this.tokens[i];
            if (typeof token.name === 'string') {
                let p = positionalArgs[nextArg];
                result[token.name] = this.capture(p, token.destructure);
                nextArg++;
            }
        }
        while (nextArg < positionalArgs.length) {
            const arg = positionalArgs[nextArg];
            if (typeof arg !== 'undefined') {
                result['a' + nextArg] = this.capture(arg);
            }
            nextArg++;
        }
        return result;
    }
    tokenize(template) {
        const tokens = [];
        let result;
        let textStart;
        while ((result = tokenizer.exec(template)) !== null) {
            if (result.index !== textStart) {
                tokens.push({ text: template.slice(textStart, result.index) });
            }
            let destructure = false;
            let token = result[0].slice(1, -1);
            if (token.indexOf('@') === 0) {
                token = token.slice(1);
                destructure = true;
            }
            tokens.push({
                name: token,
                destructure,
                raw: result[0]
            });
            textStart = tokenizer.lastIndex;
        }
        if (textStart >= 0 && textStart < template.length) {
            tokens.push({ text: template.slice(textStart) });
        }
        return tokens;
    }
    toText(property) {
        if (typeof property === 'undefined') {
            return 'undefined';
        }
        if (property === null) {
            return 'null';
        }
        if (typeof property === 'string') {
            return property;
        }
        if (typeof property === 'number') {
            return property.toString();
        }
        if (typeof property === 'boolean') {
            return property.toString();
        }
        if (typeof property.toISOString === 'function') {
            return property.toISOString();
        }
        if (typeof property === 'object') {
            let s = JSON.stringify(property);
            if (s.length > 70) {
                s = s.slice(0, 67) + '...';
            }
            return s;
        }
        return property.toString();
    }
    ;
    capture(property, destructure) {
        if (typeof property === 'function') {
            return property.toString();
        }
        if (typeof property === 'object') {
            // null value will be automatically stringified as "null", in properties it will be as null
            // otherwise it will throw an error
            if (property === null) {
                return property;
            }
            // Could use instanceof Date, but this way will be kinder
            // to values passed from other contexts...
            if (destructure || typeof property.toISOString === 'function') {
                return property;
            }
            return property.toString();
        }
        return property;
    }
}

/**
 * Logs events.
 */
class Logger {
    /**
     * Creates a new logger instance using the specified pipeline.
     */
    constructor(pipeline) {
        this.pipeline = pipeline;
    }
    /**
     * Logs an event with the {LogEventLevel.fatal} severity.
     * @param {string} messageTemplate Message template for the log event.
     * @param {any[]} properties Properties that can be used to render the message template.
     */
    fatal(messageTemplate, ...properties) {
        this.write(LogEventLevel.fatal, messageTemplate, properties);
    }
    /**
     * Logs an event with the {LogEventLevel.error} severity.
     * @param {string} messageTemplate Message template for the log event.
     * @param {any[]} properties Properties that can be used to render the message template.
     */
    error(messageTemplate, ...properties) {
        this.write(LogEventLevel.error, messageTemplate, properties);
    }
    /**
     * Logs an event with the {LogEventLevel.warning} severity.
     * @param {string} messageTemplate Message template for the log event.
     * @param {any[]} properties Properties that can be used to render the message template.
     */
    warn(messageTemplate, ...properties) {
        this.write(LogEventLevel.warning, messageTemplate, properties);
    }
    /**
     * Logs an event with the {LogEventLevel.information} severity.
     * @param {string} messageTemplate Message template for the log event.
     * @param {any[]} properties Properties that can be used to render the message template.
     */
    info(messageTemplate, ...properties) {
        this.write(LogEventLevel.information, messageTemplate, properties);
    }
    /**
     * Logs an event with the {LogEventLevel.debug} severity.
     * @param {string} messageTemplate Message template for the log event.
     * @param {any[]} properties Properties that can be used to render the message template.
     */
    debug(messageTemplate, ...properties) {
        this.write(LogEventLevel.debug, messageTemplate, properties);
    }
    /**
     * Logs an event with the {LogEventLevel.verbose} severity.
     * @param {string} messageTemplate Message template for the log event.
     * @param {any[]} properties Properties that can be used to render the message template.
     */
    verbose(messageTemplate, ...properties) {
        this.write(LogEventLevel.verbose, messageTemplate, properties);
    }
    /**
     * Flushes the pipeline of this logger.
     * @returns A {Promise<any>} that will resolve when the pipeline has been flushed.
     */
    flush() {
        return this.pipeline.flush();
    }
    /**
     * Emits events through this logger's pipeline.
     */
    emit(events) {
        this.pipeline.emit(events);
        return events;
    }
    write(level, rawMessageTemplate, unboundProperties) {
        const messageTemplate = new MessageTemplate(rawMessageTemplate);
        const properties = messageTemplate.bindProperties(unboundProperties);
        const logEvent = new LogEvent(new Date().toISOString(), level, messageTemplate, properties);
        this.pipeline.emit([logEvent]);
    }
}

class ConsoleSink {
    constructor(options) {
        this.options = options || {};
        const internalConsole = this.options.consoleProxy || typeof console !== 'undefined' && console || null;
        const stub = function () { };
        this.consoleProxy = {
            error: (internalConsole && (internalConsole.error || internalConsole.log)) || stub,
            warn: (internalConsole && (internalConsole.warn || internalConsole.log)) || stub,
            info: (internalConsole && (internalConsole.info || internalConsole.log)) || stub,
            debug: (internalConsole && (internalConsole.debug || internalConsole.log)) || stub,
            log: (internalConsole && internalConsole.log) || stub
        };
    }
    emit(events) {
        for (let i = 0; i < events.length; ++i) {
            const e = events[i];
            switch (e.level) {
                case LogEventLevel.fatal:
                    this.writeToConsole(this.consoleProxy.error, 'Fatal', e);
                    break;
                case LogEventLevel.error:
                    this.writeToConsole(this.consoleProxy.error, 'Error', e);
                    break;
                case LogEventLevel.warning:
                    this.writeToConsole(this.consoleProxy.warn, 'Warning', e);
                    break;
                case LogEventLevel.debug:
                    this.writeToConsole(this.consoleProxy.debug, 'Debug', e);
                    break;
                case LogEventLevel.verbose:
                    this.writeToConsole(this.consoleProxy.debug, 'Verbose', e);
                    break;
                case LogEventLevel.information:
                default:
                    this.writeToConsole(this.consoleProxy.info, 'Information', e);
                    break;
            }
        }
    }
    flush() {
        return Promise.resolve();
    }
    writeToConsole(logMethod, prefix, e) {
        let output = '[' + prefix + '] ' + e.messageTemplate.render(e.properties);
        if (this.options.includeTimestamps) {
            output = e.timestamp + ' ' + output;
        }
        const values = [];
        if (this.options.includeProperties) {
            for (const key in e.properties) {
                if (e.properties.hasOwnProperty(key)) {
                    values.push(e.properties[key]);
                }
            }
        }
        logMethod(output, ...values);
    }
}

class FilterStage {
    constructor(predicate) {
        this.predicate = predicate;
    }
    emit(events) {
        return events.filter(this.predicate);
    }
    flush() {
        return Promise.resolve();
    }
}

/**
 * Allows dynamic control of the logging level.
 */
class DynamicLevelSwitch {
    constructor() {
        this.minLevel = null;
        /**
         * Gets or sets a delegate that can be called when the pipeline needs to be flushed.
         * This should generally not be modified, as it will be provided by the pipeline stage.
         */
        this.flushDelegate = () => Promise.resolve();
    }
    fatal() {
        return this.flushDelegate().then(() => this.minLevel = LogEventLevel.fatal);
    }
    error() {
        return this.flushDelegate().then(() => this.minLevel = LogEventLevel.error);
    }
    warning() {
        return this.flushDelegate().then(() => this.minLevel = LogEventLevel.warning);
    }
    information() {
        return this.flushDelegate().then(() => this.minLevel = LogEventLevel.information);
    }
    debug() {
        return this.flushDelegate().then(() => this.minLevel = LogEventLevel.debug);
    }
    verbose() {
        return this.flushDelegate().then(() => this.minLevel = LogEventLevel.verbose);
    }
    isEnabled(level) {
        return this.minLevel === null || isEnabled(this.minLevel, level);
    }
}
class DynamicLevelSwitchStage extends FilterStage {
    /**
     * Sets a delegate that can be called when the pipeline needs to be flushed.
     */
    setFlushDelegate(flushDelegate) {
        this.dynamicLevelSwitch.flushDelegate = flushDelegate;
    }
    constructor(dynamicLevelSwitch) {
        super(e => dynamicLevelSwitch.isEnabled(e.level));
        this.dynamicLevelSwitch = dynamicLevelSwitch;
    }
}

class Pipeline {
    constructor() {
        this.stages = [];
        this.eventQueue = [];
        this.flushInProgress = false;
    }
    /**
     * Adds a stage to the end of the pipeline.
     * @param {PipelineStage} stage The pipeline stage to add.
     */
    addStage(stage) {
        this.stages.push(stage);
    }
    /**
     * Emits events through the pipeline. If a flush is currently in progress, the events will be queued and will been
     * sent through the pipeline once the flush is complete.
     * @param {LogEvent[]} events The events to emit.
     */
    emit(events) {
        if (this.flushInProgress) {
            this.eventQueue = this.eventQueue.concat(events);
            return this.flushPromise;
        }
        else {
            if (!this.stages.length || !events || !events.length) {
                return Promise.resolve();
            }
            let promise = Promise.resolve(this.stages[0].emit(events));
            for (let i = 1; i < this.stages.length; ++i) {
                promise = promise.then(events => this.stages[i].emit(events));
            }
            return promise;
        }
    }
    /**
     * Flushes events through the pipeline.
     * @returns A {Promise<any>} that resolves when all events have been flushed and the pipeline can accept new events.
     */
    flush() {
        if (this.flushInProgress) {
            return this.flushPromise;
        }
        this.flushInProgress = true;
        return this.flushPromise = Promise.resolve()
            .then(() => {
            if (this.stages.length === 0) {
                return;
            }
            let promise = this.stages[0].flush();
            for (let i = 1; i < this.stages.length; ++i) {
                promise = promise.then(() => this.stages[i].flush());
            }
            return promise;
        })
            .then(() => {
            this.flushInProgress = false;
            const queuedEvents = this.eventQueue.slice();
            this.eventQueue = [];
            return this.emit(queuedEvents);
        });
    }
}

class SinkStage {
    constructor(sink) {
        this.sink = sink;
    }
    emit(events) {
        this.sink.emit(events);
        return events;
    }
    flush() {
        return this.sink.flush();
    }
}

class EnrichStage {
    constructor(enricher) {
        this.enricher = enricher;
    }
    emit(events) {
        const extraProperties = this.enricher instanceof Function ? this.enricher() : this.enricher;
        for (let i = 0; i < events.length; ++i) {
            Object.assign(events[i].properties, extraProperties);
        }
        return events;
    }
    flush() {
        return Promise.resolve();
    }
}

/**
 * Configures pipelines for new logger instances.
 */
class LoggerConfiguration {
    constructor() {
        /**
         * Sets the minimum level for any subsequent stages in the pipeline.
         */
        this.minLevel = Object.assign((levelOrSwitch) => {
            if (typeof levelOrSwitch === 'undefined' || levelOrSwitch === null) {
                throw new TypeError('Argument "levelOrSwitch" is not a valid LogEventLevel value or DynamicLevelSwitch instance.');
            }
            else if (levelOrSwitch instanceof DynamicLevelSwitch) {
                const switchStage = new DynamicLevelSwitchStage(levelOrSwitch);
                const flush = this.pipeline.flush;
                switchStage.setFlushDelegate(() => this.pipeline.flush());
                this.pipeline.addStage(switchStage);
                return this;
            }
            else if (typeof levelOrSwitch === 'string') {
                const level = LogEventLevel[levelOrSwitch.toLowerCase()];
                if (typeof level === 'undefined') {
                    throw new TypeError('Argument "levelOrSwitch" is not a valid LogEventLevel value.');
                }
                return this.filter(e => isEnabled(level, e.level));
            }
            else {
                return this.filter(e => isEnabled(levelOrSwitch, e.level));
            }
        }, {
            fatal: () => this.minLevel(LogEventLevel.fatal),
            error: () => this.minLevel(LogEventLevel.error),
            warning: () => this.minLevel(LogEventLevel.warning),
            information: () => this.minLevel(LogEventLevel.information),
            debug: () => this.minLevel(LogEventLevel.debug),
            verbose: () => this.minLevel(LogEventLevel.verbose)
        });
        this.pipeline = new Pipeline();
    }
    /**
     * Adds a sink to the pipeline.
     * @param {Sink} sink The sink to add.
     */
    writeTo(sink) {
        this.pipeline.addStage(new SinkStage(sink));
        return this;
    }
    /**
     * Adds a filter to the pipeline.
     * @param {(e: LogEvent) => boolean} predicate Filter predicate to use.
     */
    filter(predicate) {
        if (predicate instanceof Function) {
            this.pipeline.addStage(new FilterStage(predicate));
        }
        else {
            throw new TypeError('Argument "predicate" must be a function.');
        }
        return this;
    }
    /**
     * Adds an enricher to the pipeline.
     */
    enrich(enricher) {
        if (enricher instanceof Function || enricher instanceof Object) {
            this.pipeline.addStage(new EnrichStage(enricher));
        }
        else {
            throw new TypeError('Argument "enricher" must be either a function or an object.');
        }
        return this;
    }
    /**
     * Creates a new logger instance based on this configuration.
     */
    create() {
        return new Logger(this.pipeline);
    }
}

function configure() {
    return new LoggerConfiguration();
}

export { configure, LoggerConfiguration, LogEventLevel, Logger, ConsoleSink, DynamicLevelSwitch };
//# sourceMappingURL=structured-log.es6.js.map