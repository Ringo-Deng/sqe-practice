import React from 'react';
import ReactDOM from 'react-dom/client';
import {ThemeProvider} from 'next-themes';
import CloudApp from './client';
import '../app/globals.css';
import './account-ui.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode><ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}><CloudApp/></ThemeProvider></React.StrictMode>,
);
