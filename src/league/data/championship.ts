import { createSquadTeam, createTeam, SquadPlayerDef } from './teamFactory'
import { Club } from '../types'

/** Compact helper: name, positions (primary first, '/' separated), rating, nationality, playstyle */
const P = (name: string, positions: string, rating: number, nationality: string, playstyle: string): SquadPlayerDef => ({
  name,
  positions: positions.split('/'),
  rating,
  nationality,
  playstyle,
})

/** The three Championship clubs with full real-player squads. */
const CHAMPIONSHIP_REAL_SQUADS: Club[] = [
  createSquadTeam({
    id: 'ipswich',
    name: 'Ipswich Town',
    shortName: 'IPS',
    color: '#003399',
    overall: 84,
    squad: [
      P('Alex Palmer', 'GK', 81, 'England', 'Sweeper Keeper'),
      P('Cieran Slicker', 'GK', 73, 'Scotland', 'Goalkeeper'),
      P('Dara O\'Shea', 'CB', 84, 'Republic of Ireland', 'Stopper'),
      P('Jacob Greaves', 'CB', 84, 'England', 'Ball-Playing Defender'),
      P('Cameron Burgess', 'CB', 82, 'Australia', 'Defensive Defender'),
      P('Ben Johnson', 'RB/LB', 81, 'England', 'Attacking Fullback'),
      P('Leif Davis', 'LB', 84, 'England', 'Attacking Fullback'),
      P('Axel Tuanzebe', 'RB/CB', 81, 'DR Congo', 'Complete Defender'),
      P('Sam Morsy', 'CDM', 82, 'Egypt', 'Holding Midfielder'),
      P('Jens Cajuste', 'CM', 83, 'Sweden', 'Box-to-Box Midfielder'),
      P('Jack Taylor', 'CM', 80, 'Republic of Ireland', 'Deep-Lying Playmaker'),
      P('Conor Chaplin', 'CAM', 83, 'England', 'Chance Creator'),
      P('Julio Enciso', 'CAM/LW', 85, 'Paraguay', 'Creative Playmaker'),
      P('Jaden Philogene', 'LW', 84, 'England', 'Explosive Winger'),
      P('Omari Hutchinson', 'RW', 85, 'England', 'Inside Forward'),
      P('Liam Delap', 'ST', 85, 'England', 'Advanced Striker'),
      P('George Hirst', 'ST', 81, 'Scotland', 'Target Forward'),
    ],
  }),

  createSquadTeam({
    id: 'coventry',
    name: 'Coventry City',
    shortName: 'COV',
    color: '#4BB4E6',
    overall: 83,
    squad: [
      P('Oliver Dovin', 'GK', 80, 'Sweden', 'Sweeper Keeper'),
      P('Ben Wilson', 'GK', 73, 'England', 'Goalkeeper'),
      P('Milan van Ewijk', 'RB', 84, 'Netherlands', 'Attacking Fullback'),
      P('Jay Dasilva', 'LB', 79, 'England', 'Attacking Fullback'),
      P('Bobby Thomas', 'CB', 82, 'England', 'Stopper'),
      P('Liam Kitching', 'CB', 81, 'England', 'Ball-Playing Defender'),
      P('Joel Latibeaudiere', 'CB/RB', 80, 'Jamaica', 'Complete Defender'),
      P('Luis Binks', 'CB', 79, 'England', 'Defensive Defender'),
      P('Matt Grimes', 'CDM', 83, 'England', 'Deep-Lying Playmaker'),
      P('Jack Rudoni', 'CM/CAM', 84, 'England', 'Box-to-Box Midfielder'),
      P('Ben Sheaf', 'CM', 82, 'England', 'Holding Midfielder'),
      P('Victor Torp', 'CAM', 82, 'Denmark', 'Chance Creator'),
      P('Tatsuhiro Sakamoto', 'RW', 84, 'Japan', 'Winger'),
      P('Ephron Mason-Clark', 'LW', 83, 'England', 'Explosive Winger'),
      P('Haji Wright', 'LW/ST', 86, 'United States', 'Inside Forward'),
      P('Ellis Simms', 'ST', 84, 'England', 'Advanced Striker'),
      P('Brandon Thomas-Asante', 'ST', 82, 'Ghana', 'Roaming Forward'),
    ],
  }),

  createSquadTeam({
    id: 'hull',
    name: 'Hull City',
    shortName: 'HUL',
    color: '#F5A800',
    overall: 81,
    squad: [
      P('Ivor Pandur', 'GK', 80, 'Croatia', 'Sweeper Keeper'),
      P('Carl Rushworth', 'GK', 79, 'England', 'Goalkeeper'),
      P('Cody Drameh', 'RB', 81, 'England', 'Attacking Fullback'),
      P('Sean McLoughlin', 'CB/LB', 80, 'Republic of Ireland', 'Ball-Playing Defender'),
      P('Charlie Hughes', 'CB', 82, 'England', 'Complete Defender'),
      P('Alfie Jones', 'CB', 80, 'England', 'Stopper'),
      P('Ryan Giles', 'LB', 82, 'England', 'Attacking Fullback'),
      P('Lewie Coyle', 'RB', 81, 'England', 'Complete Defender'),
      P('Gustavo Puerta', 'CDM/CM', 82, 'Colombia', 'Box-to-Box Midfielder'),
      P('Regan Slater', 'CM', 80, 'England', 'Box-to-Box Midfielder'),
      P('Steven Alzate', 'CM/CDM', 81, 'Colombia', 'Deep-Lying Playmaker'),
      P('Matt Crooks', 'CAM/CM', 79, 'England', 'Target Midfielder'),
      P('Abu Kamara', 'LW', 83, 'England', 'Explosive Winger'),
      P('Mohamed Belloumi', 'RW', 82, 'Algeria', 'Winger'),
      P('Louie Barry', 'LW/ST', 82, 'England', 'Inside Forward'),
      P('João Pedro Galvão', 'ST', 81, 'Brazil', 'Complete Forward'),
      P('Kyle Joseph', 'ST', 79, 'Scotland', 'Advanced Striker'),
    ],
  }),
]

/**
 * Auto-generated filler clubs to complete the Championship. The three real
 * clubs above join 17 generated clubs for a full 20-team league.
 */
const FILLER_TEAMS = [
  { name: 'Sheffield United', shortName: 'SHU', color: '#EE2737', overall: 78 },
  { name: 'Middlesbrough', shortName: 'MID', color: '#E5231C', overall: 76 },
  { name: 'West Bromwich Albion', shortName: 'WBA', color: '#122F67', overall: 76 },
  { name: 'Norwich City', shortName: 'NOR', color: '#00A650', overall: 75 },
  { name: 'Stoke City', shortName: 'STK', color: '#E03A3E', overall: 74 },
  { name: 'Swansea City', shortName: 'SWA', color: '#000000', overall: 74 },
  { name: 'Blackburn Rovers', shortName: 'BLB', color: '#009EE0', overall: 73 },
  { name: 'Cardiff City', shortName: 'CAR', color: '#0070B5', overall: 73 },
  { name: 'Bristol City', shortName: 'BRI', color: '#E11A22', overall: 73 },
  { name: 'Preston North End', shortName: 'PNE', color: '#041E42', overall: 73 },
  { name: 'Millwall', shortName: 'MIL', color: '#00356B', overall: 73 },
  { name: 'Queens Park Rangers', shortName: 'QPR', color: '#0055A5', overall: 72 },
  { name: 'Derby County', shortName: 'DER', color: '#FFFFFF', overall: 72 },
  { name: 'Watford', shortName: 'WAT', color: '#FBEE23', overall: 72 },
  { name: 'Burnley', shortName: 'BUR', color: '#6C1D45', overall: 72 },
  { name: 'Luton Town', shortName: 'LUT', color: '#F78F1E', overall: 71 },
  { name: 'Oxford United', shortName: 'OXF', color: '#FFCD00', overall: 70 },
]

export const CHAMPIONSHIP_TEAMS = [
  ...CHAMPIONSHIP_REAL_SQUADS,
  ...FILLER_TEAMS.map((f, i) =>
    createTeam({
      id: `champ-filler-${i + 1}`,
      name: f.name,
      shortName: f.shortName,
      color: f.color,
      nationality: 'english',
      overall: f.overall,
      stars: [],
    })
  ),
]
