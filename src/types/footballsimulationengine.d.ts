declare module "footballsimulationengine" {
  export function initiateGame(team1: any, team2: any, pitchDetails: any): Promise<any>;
  export function playIteration(matchDetails: any): Promise<any>;
  export function startSecondHalf(matchDetails: any): Promise<any>;
}
