import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';

const production = !process.env.ROLLUP_WATCH;

export default {
	// Use a bootstrap file (we'll create src/main.js next)
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'public/build/bundle.js'
	},
	plugins: [
		svelte({
			dev: !production,
			css: (css) => {
				css.write('bundle.css');
			}
		}),
		// Extract any component CSS into a separate file
		css({ output: 'bundle.css' }),
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),
		// In dev mode, start livereload so the browser refreshes on changes
		!production && livereload('public'),
		// Minify in production
		production && terser()
	],
	watch: {
		clearScreen: false
	}
};
