export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>OpenCV 5 · Amazon Bedrock · AWS Lambda</p>
        <p>
          Sample images:{' '}
          <a
            className="underline decoration-line underline-offset-2 hover:text-fg"
            href="https://amazon-berkeley-objects.s3.amazonaws.com/index.html"
            target="_blank"
            rel="noreferrer"
          >
            Amazon Berkeley Objects
          </a>{' '}
          (CC BY 4.0)
        </p>
      </div>
    </footer>
  );
}
