import './globals.css';

export const metadata = {
  title: 'Sift — Spending Intelligence',
  description: 'AI agent that discovers hidden patterns in your spending data',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
