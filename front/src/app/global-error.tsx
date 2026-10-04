'use client';

/** Last-resort boundary (root layout failed): no providers/translations available here. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          margin: 0,
          background: '#faf7f2',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1>Что-то пошло не так · Something went wrong</h1>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '12px 20px',
              borderRadius: 999,
              border: 0,
              background: '#c2410c',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            Повторить · Retry
          </button>
        </div>
      </body>
    </html>
  );
}
