import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  state = { err: null }
  static getDerivedStateFromError(e) { return { err: e } }
  render() {
    if (this.state.err) return (
      <div style={{padding:'2rem',background:'#fee2e2',minHeight:'100vh',fontFamily:'monospace'}}>
        <h2 style={{color:'#dc2626'}}>POS Error</h2>
        <p style={{color:'#7f1d1d',marginTop:'1rem'}}>{this.state.err.message}</p>
        <pre style={{fontSize:'0.75rem',color:'#7f1d1d',whiteSpace:'pre-wrap',marginTop:'1rem'}}>{this.state.err.stack}</pre>
        <button onClick={()=>window.location.reload()} style={{marginTop:'1rem',padding:'0.5rem 1.5rem',background:'#dc2626',color:'white',border:'none',borderRadius:'8px',cursor:'pointer'}}>Reload</button>
      </div>
    )
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
