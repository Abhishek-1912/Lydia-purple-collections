import { Link } from 'react-router-dom'
import { Lotus } from '../components/Icons.jsx'

export default function NotFound() {
  return (
    <section className="container page-narrow center">
      <div className="gold"><Lotus size={56} /></div>
      <h1>Page not found</h1>
      <p className="display">This page has wandered off like a loose pallu.</p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </section>
  )
}
