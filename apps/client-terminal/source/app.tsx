// import React from 'react';
// import {Text} from 'ink';

// type Props = {
// 	name: string | undefined;
// };

// export default function App({name = 'Stranger'}: Props) {
// 	return (
// 		<Text>
// 			Hello, <Text color="green">{name}</Text>
// 		</Text>
// 	);
// }

import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
// import TextInput from 'ink-text-input';
import WebSocket from 'ws';

// Configuration
const SERVER_URL = process.env['MUD_SERVER_URL'] || 'ws://localhost:3000/ws';

export default function App() {
	const {exit} = useApp(); // To exit the Ink app
	const [isConnected, setIsConnected] = useState(false);
	const [outputLines, setOutputLines] = useState<string[]>(['Connecting...']);
	const [inputValue, setInputValue] = useState('');
	const wsRef = useRef<WebSocket | null>(null);

	// Effect to handle the WebSocket connection
	useEffect(() => {
		const connectWebSocket = () => {
			console.log(`Attempting to connect to ${SERVER_URL}...`);
			const ws = new WebSocket(SERVER_URL);
			wsRef.current = ws;

			ws.on('open', () => {
				console.log('WebSocket Connected');
				setIsConnected(true);
				setOutputLines(prev => [...prev, '--- Connected to server ---']);
			});

			ws.on('message', (data: Buffer) => {
				const rawMessage = data.toString();
				console.log('Raw message received:', rawMessage);
				try {
					const message = JSON.parse(rawMessage);

					// Handle different types of structured messages
					switch (message.type) {
						case 'text': // Simple text message (welcome, echo, newline)
						case 'error': // Error message
							setOutputLines(prev => [...prev, message.payload]);
							break;
						case 'stream_chunk':
							// Append the chunk to the last line of the output
							setOutputLines(prev => {
								if (prev.length === 0) {
									// If there is no output, start a new line
									return [message.payload];
								}
								const lastIndex = prev.length - 1;
								// Create a new array for React state update
								const newOutput = [...prev];
								// Modify the last line by adding the chunk
								newOutput[lastIndex] =
									(newOutput[lastIndex] || '') + message.payload;
								return newOutput;
							});
							break;
						default:
							// Unstructured or unknown message type, add it as is
							console.warn('Received unhandled message format:', message);
							setOutputLines(prev => [...prev, rawMessage]);
							break;
					}
				} catch (e) {
					// If the message is not JSON, treat it as simple text
					console.log('Received non-JSON message:', rawMessage);
					setOutputLines(prev => [...prev, rawMessage]);
				}
			});

			ws.on('close', (code: number, reason: Buffer) => {
				console.log('WebSocket Closed:', code, reason.toString());
				setIsConnected(false);
				setOutputLines(prev => [
					...prev,
					`--- Disconnected from server (${code}) ---`,
					'Attempting to reconnect in 5s...',
				]);
				wsRef.current = null;
				// Try to reconnect after a while
				setTimeout(connectWebSocket, 5000);
			});

			ws.on('error', (error: Error) => {
				console.error('WebSocket Error:', error.message);
				setOutputLines(prev => [
					...prev,
					`--- WebSocket Error: ${error.message} ---`,
				]);
				// The closure will be handled by the 'onclose' handler
			});
		};

		connectWebSocket();

		// Cleanup function to close the WS when the component unmounts
		return () => {
			console.log('Closing WebSocket connection...');
			wsRef.current?.close();
		};
	}, []); // Execute only on mount

	// Hook to handle user input from the terminal
	useInput((input, key) => {
		if (key.return) {
			// Pressed return
			if (inputValue.trim() && wsRef.current && isConnected) {
				const commandToSend = inputValue.trim();
				// Add the sent command to the output for local visibility
				setOutputLines(prev => [...prev, `> ${commandToSend}`]);
				try {
					wsRef.current.send(commandToSend);
					setInputValue(''); // Clear input after sending
				} catch (err) {
					console.error('Failed to send message:', err);
					setOutputLines(prev => [
						...prev,
						`--- Error sending command: ${
							err instanceof Error ? err.message : String(err)
						} ---`,
					]);
				}
			}
		} else if (key.delete || key.backspace) {
			setInputValue(prev => prev.slice(0, -1));
		} else if (!key.ctrl && !key.meta && !key.tab) {
			// Ignore special/modifier keys
			setInputValue(prev => prev + input);
		}

		// Command to exit (example)
		if (inputValue.toLowerCase() === '/quit') {
			exit();
		}
	});

	// Rendering the Ink UI
	return (
		<Box flexDirection="column" width="100%" height="100%">
			{/* Output area (manually scrollable in the terminal for now) */}
			<Box flexDirection="column" flexGrow={1} overflowY="hidden">
				{/* Show only the last N lines to avoid terminal overflow */}
				{outputLines.slice(-process.stdout.rows + 2).map((line, index) => (
					<Text key={index}>{line}</Text>
				))}
			</Box>
			{/* Separator line and Input */}
			<Box
				borderStyle="single"
				paddingX={1}
				borderColor={isConnected ? 'green' : 'red'}
			>
				<Text>{isConnected ? 'Connected' : 'Disconnected'}&gt; Input: </Text>
				<Text>{inputValue}</Text>
				<Text>█</Text>
			</Box>
		</Box>
	);
}

// Avvia il rendering dell'app Ink
// render(<App />);
