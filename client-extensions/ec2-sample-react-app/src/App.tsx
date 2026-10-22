import {useEffect, useState} from 'react';

type Account = {
	emailAddress: string;
	name: string;
};

type AccountState =
	| {status: 'loading'}
	| {status: 'guest'}
	| {account: Account; status: 'signed-in'}
	| {message: string; status: 'error'};

// Calls Liferay's headless API through Liferay.Util.fetch, which sends the user's session
// and CSRF token. Plain fetch() would call the API anonymously.
function useCurrentAccount(): AccountState {
	const [state, setState] = useState<AccountState>({status: 'loading'});

	useEffect(() => {
		if (!Liferay.ThemeDisplay.isSignedIn()) {
			setState({status: 'guest'});

			return;
		}

		Liferay.Util.fetch('/o/headless-admin-user/v1.0/my-user-account')
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				return response.json();
			})
			.then((account: Account) => setState({account, status: 'signed-in'}))
			.catch((error: Error) =>
				setState({message: error.message, status: 'error'})
			);
	}, []);

	return state;
}

function App() {
	const [clicks, setClicks] = useState(0);
	const account = useCurrentAccount();

	return (
		<div className="ec2-sample-react-app">
			<h3 className="ec2-sample-react-app__title">
				Hello from React on Amazon EC2
			</h3>

			<p>
				This widget is a custom element client extension, built with
				Vite from the sample workspace and deployed by GitHub Actions.
			</p>

			<p className="ec2-sample-react-app__account">
				{account.status === 'loading' && 'Checking who you are...'}

				{account.status === 'guest' &&
					'You are a guest. Sign in to see your account from the headless API.'}

				{account.status === 'signed-in' &&
					`Signed in as ${account.account.name} (${account.account.emailAddress}), read from /o/headless-admin-user.`}

				{account.status === 'error' &&
					`Could not read your account: ${account.message}`}
			</p>

			<button
				className="btn btn-primary"
				onClick={() => setClicks((count) => count + 1)}
				type="button"
			>
				Clicked {clicks} {clicks === 1 ? 'time' : 'times'}
			</button>
		</div>
	);
}

export default App;
