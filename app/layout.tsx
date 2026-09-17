import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'SQE Practice · 刷题室',description:'英文刷题、双语解析、答题记录与错题复习。',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>}
