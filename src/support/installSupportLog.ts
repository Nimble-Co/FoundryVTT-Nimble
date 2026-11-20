import { isNimbleLine, type LogLevel, SupportLog, stackFrames } from './supportLog.js';

/** The one log of this page. It starts when the system's code loads. */
const supportLog = new SupportLog();

function messageOf(args: unknown[]): string {
	return args
		.filter((arg) => typeof arg === 'string' || arg instanceof Error)
		.map((arg) => (arg instanceof Error ? arg.message : arg))
		.join(' ');
}

/** Foundry's own Notifications methods, in V8 or Firefox form. */
const NOTIFICATIONS_FRAME = /^(?:at Notifications\.|(?:notify|error|warn|info|success)@)/;

/** The caller's stack, without this function, the wrapper that calls it and the leading frames that match `skip`. */
function callerStack(skip?: RegExp): string {
	const frames = stackFrames(new Error().stack).slice(2);
	const first = skip ? frames.findIndex((frame) => !skip.test(frame)) : 0;
	return frames.slice(first === -1 ? frames.length : first).join('\n');
}

/**
 * Foundry writes each popup to the console too: at once, or later when the popup waits in a queue.
 * The console wrapper skips those lines, so the popup is not in the log two times.
 */
let notifying = false;
const queuedEchoes: string[] = [];

function isPopupEcho(level: LogLevel, message: string): boolean {
	if (notifying) return true;
	const index = queuedEchoes.indexOf(`${level}|${message}`);
	if (index === -1) return false;
	queuedEchoes.splice(index, 1);
	return true;
}

function wrapConsole(method: 'warn' | 'error', level: LogLevel): void {
	const original = console[method].bind(console);
	console[method] = (...args: unknown[]) => {
		const message = messageOf(args);
		if (isNimbleLine(args[0]) && !isPopupEcho(level, message)) {
			const error = args.find((arg): arg is Error => arg instanceof Error);
			supportLog.record({
				level,
				source: 'nimble',
				message,
				stack: error?.stack ?? callerStack(),
			});
		}
		original(...args);
	};
}

function wrapNotifications(): void {
	const prototype = (globalThis as { foundry?: any }).foundry?.applications?.ui?.Notifications
		?.prototype as
		| { notify: (...args: any[]) => { message: string; active?: boolean; console?: boolean } }
		| undefined;
	if (!prototype) return;
	const original = prototype.notify;
	prototype.notify = function (this: unknown, message: unknown, type?: string, ...rest: unknown[]) {
		notifying = true;
		let notification: ReturnType<typeof original>;
		try {
			notification = original.call(this, message, type, ...rest);
		} finally {
			notifying = false;
		}
		if (type === 'error' || type === 'warning') {
			const level: LogLevel = type === 'error' ? 'error' : 'warning';
			const text = String(notification?.message ?? message).replace(/<[^>]*>/g, '');
			if (notification?.active === false && notification.console !== false && isNimbleLine(text)) {
				queuedEchoes.push(`${level}|${text}`);
			}
			supportLog.record({
				level,
				source: 'popup',
				message: text,
				stack: message instanceof Error ? message.stack : callerStack(NOTIFICATIONS_FRAME),
			});
		}
		return notification;
	};
}

function listenForUncaught(): void {
	window.addEventListener('error', (event) => {
		supportLog.record({
			level: 'error',
			source: 'uncaught',
			message: event.error instanceof Error ? String(event.error) : event.message,
			stack: event.error?.stack ?? (event.filename ? `    at ${event.filename}` : null),
		});
	});
	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason;
		supportLog.record({
			level: 'error',
			source: 'uncaught',
			message: reason instanceof Error ? String(reason) : String(reason),
			stack: reason instanceof Error ? reason.stack : null,
		});
	});
}

wrapConsole('warn', 'warning');
wrapConsole('error', 'error');
wrapNotifications();
listenForUncaught();

export { supportLog };
