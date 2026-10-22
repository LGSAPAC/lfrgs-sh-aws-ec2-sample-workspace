// The parts of the global Liferay object this app uses. Liferay defines it on every page.
declare const Liferay: {
	ThemeDisplay: {
		getPortalURL: () => string;
		isSignedIn: () => boolean;
	};
	Util: {
		fetch: typeof fetch;
	};
};
