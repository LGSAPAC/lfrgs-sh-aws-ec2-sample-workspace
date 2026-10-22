import {createRoot, type Root} from 'react-dom/client';

import App from './App';

import './styles/index.css';

const ELEMENT_NAME = 'ec2-sample-react-app';

class Ec2SampleReactApp extends HTMLElement {
	private root: Root | null = null;

	connectedCallback() {
		if (!this.root) {
			this.root = createRoot(this);
		}

		this.root.render(<App />);
	}

	// Unmount on single-page navigation so React doesn't leak the old page's tree.
	disconnectedCallback() {
		this.root?.unmount();
		this.root = null;
	}
}

if (!customElements.get(ELEMENT_NAME)) {
	customElements.define(ELEMENT_NAME, Ec2SampleReactApp);
}
