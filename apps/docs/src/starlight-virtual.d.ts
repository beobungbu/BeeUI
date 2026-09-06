// Type declarations for the two Starlight virtual modules that src/components/Search.astro
// imports. Starlight declares them in its own virtual.d.ts / virtual-internal.d.ts, which its
// package exports do not expose, so `astro check` cannot see them from an override. The shapes
// below are copied from Starlight 0.41 and must be refreshed with the override itself (the
// upstream-equality test in scripts/__tests__/pagefind-query.test.mjs flags that moment).
declare module 'virtual:starlight/project-context' {
	const ProjectContext: {
		root: string;
		srcDir: string;
		trailingSlash: import('astro').AstroConfig['trailingSlash'];
		build: {
			format: import('astro').AstroConfig['build']['format'];
		};
	};
	export default ProjectContext;
}

declare module 'virtual:starlight/pagefind-config' {
	export const pagefindUserConfig: Partial<
		Extract<import('@astrojs/starlight/types').StarlightConfig['pagefind'], object>
	>;
}
