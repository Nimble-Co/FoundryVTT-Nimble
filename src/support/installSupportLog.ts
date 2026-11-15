import { type LogLevel, SupportLog } from './supportLog.js';

/** The one log of this page. It starts when the system's code loads. */
const supportLog = new SupportLog();

function messageOf(args: unknown[]): string {
	return args
		.filter((arg) => typeof arg === 'string' || arg instanceof Error)
		.map((arg) => (arg instanceof Error ? arg.message : arg))
		.join(' ');
}

/** The caller's stack, without this function and the wrapper that calls it. */
function callerStack(): string {
	return (new Error().stack ?? '').split('\n').slice(3).join('\n');
}

function wrapConsole(method: 'warn' | 'error', level: LogLevel): void {
	const original = console[method].bind(console);
	console[method] = (...args: unknown[]) => {
		if (typeof args[0] === 'string' && args[0].startsWith('Nimble')) {
			const error = args.find((arg): arg is Error => arg instanceof Error);
			supportLog.record({
				level,
				source: 'nimble',
				message: messageOf(args),
				stack: error?.stack ?? callerStack(),
			});
		}
		original(...args);
	};
}

function wrapNotifications(): void {
	const prototype = (globalThis as { foundry?: any }).foundry?.applications?.ui?.Notifications
		?.prototype as { notify: (...args: any[]) => { message: string } } | undefined;
	if (!prototype) return;
	const original = prototype.notify;
	prototype.notify = function (this: unknown, message: unknown, type?: string, ...rest: unknown[]) {
		const notification = original.call(this, message, type, ...rest);
		if (type === 'error' || type === 'warning') {
			supportLog.record({
				level: type === 'error' ? 'error' : 'warning',
				source: 'popup',
				message: String(notification?.message ?? message).replace(/<[^>]*>/g, ''),
				stack: message instanceof Error ? message.stack : callerStack(),
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
