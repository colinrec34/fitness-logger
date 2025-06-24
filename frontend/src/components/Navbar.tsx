import { Link } from 'react-router-dom'

const links = [
  { name: 'Home', path: '/' },
  { name: 'Weight', path: '/log/weight' },
  { name: 'Lifting', path: '/log/lifts' },
  { name: 'Hikes', path: '/log/hikes' },
  { name: 'Surf', path: '/log/surf' },
  { name: 'Runs', path: '/log/run' },
  { name: 'Snorkeling', path: '/log/snorkel' },
]

export default function Navbar() {
  return (
    <nav className="bg-slate-900 text-white p-4 shadow flex gap-4">
      {links.map(link => (
        <Link
          key={link.path}
          to={link.path}
          className="hover:text-yellow-300 transition"
        >
          {link.name}
        </Link>
      ))}
    </nav>
  )
}
