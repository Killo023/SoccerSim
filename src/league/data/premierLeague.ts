import { createTeam } from './teamFactory'
import { PREMIER_LEAGUE_SQUADS } from './premierLeagueSquads'

// The 17 clubs with full real-player squads (see premierLeagueSquads.ts)
// plus West Ham, Wolves & Southampton which keep auto-generated squads
// (their real databases were not provided).
export const PREMIER_LEAGUE_TEAMS = [
  ...PREMIER_LEAGUE_SQUADS,
  createTeam({
    id: 'westham', name: 'West Ham United', shortName: 'WHU', color: '#7A263A', nationality: 'english', overall: 79,
    stars: [
      { name: 'J. Bowen', number: 20, position: 'RW', rating: 84 },
      { name: 'L. Paqueta', number: 10, position: 'CAM', rating: 83 },
      { name: 'E. Alvarez', number: 19, position: 'CDM', rating: 82 },
      { name: 'J. Ward-Prowse', number: 7, position: 'CM', rating: 82 },
      { name: 'M. Antonio', number: 9, position: 'ST', rating: 80 },
      { name: 'K. Zouma', number: 4, position: 'CB', rating: 81 },
      { name: 'N. Aguerd', number: 27, position: 'CB', rating: 80 },
      { name: 'A. Areola', number: 23, position: 'GK', rating: 80 },
      { name: 'E. Ogbonna', number: 21, position: 'CB', rating: 77 },
      { name: 'V. Coufal', number: 5, position: 'RB', rating: 78 },
      { name: 'Lucas Paqueta', number: 10, position: 'LW', rating: 82 },
    ],
  }),
  createTeam({
    id: 'wolves', name: 'Wolverhampton Wanderers', shortName: 'WOL', color: '#FDB913', nationality: 'english', overall: 77,
    stars: [
      { name: 'P. Neto', number: 7, position: 'LW', rating: 82 },
      { name: 'M. Cunha', number: 12, position: 'ST', rating: 81 },
      { name: 'R. Gomes', number: 8, position: 'CM', rating: 79 },
      { name: 'J. Gomes', number: 15, position: 'CM', rating: 78 },
      { name: 'C. Dawson', number: 15, position: 'CB', rating: 79 },
      { name: 'T. Lemina', number: 5, position: 'CDM', rating: 79 },
      { name: 'M. Lemina', number: 20, position: 'CM', rating: 78 },
      { name: 'J. Sa', number: 1, position: 'GK', rating: 79 },
      { name: 'N. Semedo', number: 22, position: 'RB', rating: 78 },
      { name: 'S. Bueno', number: 17, position: 'LB', rating: 76 },
      { name: 'H. Hwang', number: 11, position: 'RW', rating: 78 },
    ],
  }),
  createTeam({
    id: 'southampton', name: 'Southampton', shortName: 'SOU', color: '#D71920', nationality: 'english', overall: 76,
    stars: [
      { name: 'J. Armstrong', number: 9, position: 'ST', rating: 78 },
      { name: 'C. Adams', number: 10, position: 'ST', rating: 78 },
      { name: 'F. Downes', number: 4, position: 'CDM', rating: 77 },
      { name: 'W. Smallbone', number: 16, position: 'CM', rating: 76 },
      { name: 'J. Bednarek', number: 35, position: 'CB', rating: 77 },
      { name: 'T. Harwood-Bellis', number: 5, position: 'CB', rating: 77 },
      { name: 'K. Walker-Peters', number: 2, position: 'RB', rating: 78 },
      { name: 'G. Bazunu', number: 31, position: 'GK', rating: 77 },
      { name: 'S. Armstrong', number: 17, position: 'CAM', rating: 77 },
      { name: 'R. Manning', number: 3, position: 'LB', rating: 75 },
      { name: 'S. Amo-Ameyaw', number: 23, position: 'RW', rating: 74 },
    ],
  }),
]
