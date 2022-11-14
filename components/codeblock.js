
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow } from "react-syntax-highlighter/dist/cjs/styles/prism";


const CodeBlock = {
  code({node, inline, className, children, ...props}) {
    const match = /language-(\w+)/.exec(className || '')
    const lang = match? match[1] : "bash"
    return !inline ? (
      <SyntaxHighlighter
        children={String(children).replace(/\n$/, '')}
        style={tomorrow}
        language={lang}
        showLineNumbers={true}
        PreTag="div"
        wrapLines={true}
        {...props}
      />
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
}

export default CodeBlock