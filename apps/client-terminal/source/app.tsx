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
// Potrebbe servire TextInput se non si usa useInput direttamente per l'input
// import TextInput from 'ink-text-input';
import WebSocket from 'ws'; // Usa la libreria 'ws' per il client Node.js

// Configurazioni
const SERVER_URL = process.env['MUD_SERVER_URL'] || 'ws://localhost:3000/ws';

export default function App() {
	const {exit} = useApp(); // Per uscire dall'app Ink
	const [isConnected, setIsConnected] = useState(false);
	const [outputLines, setOutputLines] = useState<string[]>(['Connecting...']);
	const [inputValue, setInputValue] = useState('');
	const wsRef = useRef<WebSocket | null>(null);

	// Effetto per gestire la connessione WebSocket
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
				const message = data.toString();
				// Aggiungi ogni riga del messaggio come linea separata
				message.split('\n').forEach(line => {
					setOutputLines(prev => [...prev, line]);
				});
				console.log('Received message:', message);
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
				// Prova a riconnetterti dopo un po'
				setTimeout(connectWebSocket, 5000);
			});

			ws.on('error', (error: Error) => {
				console.error('WebSocket Error:', error.message);
				setOutputLines(prev => [
					...prev,
					`--- WebSocket Error: ${error.message} ---`,
				]);
				// La chiusura verrà gestita dall'handler 'onclose'
			});
		};

		connectWebSocket();

		// Funzione di cleanup per chiudere il WS quando il componente smonta
		return () => {
			console.log('Closing WebSocket connection...');
			wsRef.current?.close();
		};
	}, []); // Esegui solo al mount

	// Hook per gestire l'input utente da terminale
	useInput((input, key) => {
		if (key.return) {
			// Invio premuto
			if (inputValue.trim() && wsRef.current && isConnected) {
				const commandToSend = inputValue.trim();
				// Aggiungi il comando inviato all'output per visibilità locale
				setOutputLines(prev => [...prev, `> ${commandToSend}`]);
				try {
					wsRef.current.send(commandToSend);
					setInputValue(''); // Pulisci input dopo l'invio
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
			// Ignora tasti speciali/modificatori
			setInputValue(prev => prev + input);
		}

		// Comando per uscire (esempio)
		if (inputValue.toLowerCase() === '/quit') {
			exit();
		}
	});

	// Rendering dell'UI con Ink
	return (
		<Box flexDirection="column" width="100%" height="100%">
			{/* Area Output (Scrollabile manualmente nel terminale per ora) */}
			<Box flexDirection="column" flexGrow={1} overflowY="hidden">
				{/* Mostra solo le ultime N righe per evitare overflow terminale */}
				{outputLines.slice(-process.stdout.rows + 2).map((line, index) => (
					<Text key={index}>{line}</Text>
				))}
			</Box>
			{/* Riga Separatore e Input */}
			<Box
				borderStyle="single"
				paddingX={1}
				borderColor={isConnected ? 'green' : 'red'}
			>
				<Text>{isConnected ? 'Connected' : 'Disconnected'}&gt; Input: </Text>
				<Text>{inputValue}</Text>
				{/* Cursor (simulato) */}
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text> </Text>
				<Text>█</Text>
			</Box>
		</Box>
	);
}

// Avvia il rendering dell'app Ink
// render(<App />);
