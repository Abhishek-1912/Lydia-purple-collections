import { Component } from 'react'
import { whatsappLink } from '../lib/config.js'

// Shows a friendly screen instead of a blank page if something crashes while rendering.
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error(error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="container page-narrow center">
        <h1>Something went wrong</h1>
        <p className="display">Sorry — this page hit a problem. Your cart is safe.</p>
        <div className="stack">
          <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>Reload page</button>
          <a className="btn btn-wa btn-block" href={whatsappLink('Hi! The website showed an error.')} target="_blank" rel="noreferrer">Tell us on WhatsApp</a>
        </div>
      </section>
    )
  }
}
