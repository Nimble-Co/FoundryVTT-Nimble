type LogLevel = 'error' | 'warning';

/** A popup is a red or yellow notification, a Nimble entry is a Nimble console line, and uncaught comes from any package. */
type LogSource = 'popup' | 'nimble' | 'uncaught';

interface LogInput {
	level: LogLevel;
	source: LogSource;
	message: string;
	stack?: string | null;
}

interface LogEntry {
	level: LogLevel;
	source: LogSource;
	/** The module or system the first stack line points into. */
	packageId: string | null;
	message: string;
	stack: string[];
	count: number;
}

const MAX_ENTRIES = 200;
const STACK_LINES = 6;

const V8_FRAME = /^at /;
const FIREFOX_FRAME = /^([^@\s]*)@(\S+:\d+:\d+)$/;

/** The frame lines of a stack, in the V8 form "at f (url)" or the Firefox form "f@url". */
function stackFrames(stack: string | null | undefined): string[] {
	return (stack ?? '')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => V8_FRAME.test(line) || FIREFOX_FRAME.test(line));
}

/** "at f (http://host:30000/modules/x/a.js?v=3:1:2)" and "f@http://host:30000/modules/x/a.js?v=3:1:2" become "f (modules/x/a.js:1:2)". */
function frameText(frame: string): string {
	const firefox = frame.match(FIREFOX_FRAME);
	const text = firefox
		? firefox[1]
			? `${firefox[1]} (${firefox[2]})`
			: firefox[2]
		: frame.slice(3);
	return text.replace(/[a-z]+:\/\/[^/\s]+\//gi, '').replace(/\?[^:)\s]*/g, '');
}

/** "Nimble | ...", "Nimble: ..." and "[Nimble][CT] ...". */
function isNimbleLine(first: unknown): boolean {
	return typeof first === 'string' && /^\[?Nimble\b/.test(first);
}

function packageOf(lines: string[]): string | null {
	for (const line of lines) {
		const match = line.match(/\b(?:modules|systems)\/([^/]+)\//);
		if (match) return match[1];
	}
	return null;
}

/** The errors and warnings since the world loaded, each different one once with a count. */
class SupportLog {
	#entries = new Map<string, LogEntry>();

	#dropped = 0;

	get entries(): LogEntry[] {
		return [...this.#entries.values()];
	}

	/** Different entries that came after the log was full. */
	get dropped(): number {
		return this.#dropped;
	}

	record(input: LogInput): void {
		const stack = stackFrames(input.stack).slice(0, STACK_LINES).map(frameText);
		const packageId = packageOf(stack);
		const key = `${input.level}|${input.source}|${packageId ?? ''}|${input.message}`;
		const entry = this.#entries.get(key);
		if (entry) {
			entry.count += 1;
			return;
		}
		if (this.#entries.size >= MAX_ENTRIES) {
			this.#dropped += 1;
			return;
		}
		this.#entries.set(key, {
			level: input.level,
			source: input.source,
			packageId,
			message: input.message,
			stack,
			count: 1,
		});
	}
}

export { isNimbleLine, SupportLog, stackFrames };
export type { LogEntry, LogInput, LogLevel, LogSource };
