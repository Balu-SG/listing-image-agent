export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 text-[12.5px] text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Built with <span className="text-muted">OpenCV 5</span> · <span className="text-muted">Claude on Amazon Bedrock</span> ·{' '}
          <span className="text-muted">AWS Lambda</span>
        </p>
        <p>
          Sample images:{' '}
          <a
            className="text-muted underline decoration-line-strong underline-offset-2 hover:text-fg"
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
