// Temporary, read-only summary of a Firefox processed profile (format v36, shared tables). Safe to delete.
import { readFile } from 'node:fs/promises';

const [file, threadFilter = ''] = process.argv.slice(2);
const profile = JSON.parse(await readFile(file, 'utf8'));
const categories = profile.meta.categories.map(({ name }) => name);
const { stackTable, frameTable, funcTable, sources, stringArray: strings } = profile.shared;

const top = (entries, count = 12) => [...entries.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);
/** Stack prefixes are stored as an offset back from the stack's own index; 0 means no parent. */
const prefixOf = (s) => (stackTable.prefixOffset[s] === 0 ? null : s - stackTable.prefixOffset[s]);
const labelOf = (s) => {
	const func = frameTable.func[stackTable.frame[s]];
	const source = funcTable.source[func];
	const fileName = source === null || source === undefined ? '' : (strings[sources.filename[source]] ?? '');
	return `${strings[funcTable.name[func]]} ${fileName.split('/').slice(-2).join('/')}`.trim();
};

for (const thread of profile.threads) {
	const { samples } = thread;
	if (!samples.length) continue;
	if (threadFilter && !`${thread.pid}`.includes(threadFilter)) continue;
	const byCategory = new Map();
	const selfByFunc = new Map();
	const totalByFunc = new Map();
	let busy = 0;

	for (let i = 0; i < samples.length; i++) {
		const stack = samples.stack[i];
		if (stack === null || stack === undefined) continue;
		const weight = samples.weight?.[i] ?? 1;
		const category = categories[frameTable.category[stackTable.frame[stack]]] ?? '?';
		// Skip samples where the thread was just waiting for work.
		if (/cvwait|mach_msg|kevent|poll|WaitForWorkerEvents|psynch/.test(labelOf(stack))) continue;
		busy += weight;
		byCategory.set(category, (byCategory.get(category) ?? 0) + weight);
		const self = labelOf(stack);
		selfByFunc.set(self, (selfByFunc.get(self) ?? 0) + weight);
		const seen = new Set();
		for (let s = stack; s !== null; s = prefixOf(s)) {
			const name = labelOf(s);
			if (seen.has(name)) continue;
			seen.add(name);
			totalByFunc.set(name, (totalByFunc.get(name) ?? 0) + weight);
		}
	}
	if (busy < 5) continue;
	console.log(`\n=== ${thread.processName ?? ''} / ${thread.name} pid ${thread.pid} (busy ${busy} samples, interval ${profile.meta.interval}ms)`);
	console.log('categories:', top(byCategory).map(([k, v]) => `${k} ${v}`).join(', '));
	console.log('top self:');
	top(selfByFunc, 10).forEach(([k, v]) => console.log(`  ${v}  ${k.slice(0, 140)}`));
	console.log('top inclusive:');
	top(totalByFunc, 16).forEach(([k, v]) => console.log(`  ${v}  ${k.slice(0, 140)}`));
}
