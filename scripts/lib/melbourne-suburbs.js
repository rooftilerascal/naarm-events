// Greater Melbourne suburbs, used to filter out regional/rural Victorian towns from
// sources (like Music Victoria) that cover the whole state.
//
// Boundary rule: end of the metro train line (e.g. Belgrave included, Monbulk excluded
// — Monbulk is further into the Dandenong Ranges with no station of its own). For
// corridors between train lines (no rail at all, e.g. Doncaster, Warrandyte), suburbs
// are included if they're clearly built-up middle-ring Melbourne rather than a separate
// rural town.
//
// Not exhaustive and not guaranteed perfect — extend/correct as you notice gaps, same
// as the venues table. One deliberate judgment call: the Stony Point line (Baxter,
// Somerville, Tyabb, Hastings, Bittern, Crib Point) is technically a Metro Trains
// Melbourne line but reads as Mornington Peninsula rather than "Melbourne" in
// character, so it's excluded here — flag it if you'd rather have it included.
export const MELBOURNE_METRO_SUBURBS = new Set(
  [
    // Inner Melbourne
    'Melbourne', 'Melbourne CBD', 'Southbank', 'Docklands', 'East Melbourne', 'North Melbourne',
    'West Melbourne', 'South Wharf', 'Carlton', 'Carlton North', 'Parkville',
    // Inner north
    'Fitzroy', 'Fitzroy North', 'Collingwood', 'Abbotsford', 'Clifton Hill', 'Northcote',
    'Thornbury', 'Preston', 'Reservoir', 'Brunswick', 'Brunswick East', 'Brunswick West',
    'Coburg', 'Coburg North', 'Pascoe Vale', 'Pascoe Vale South', 'Fawkner', 'Batman', 'Merlynston',
    // Inner east
    'Richmond', 'Cremorne', 'Burnley', 'Hawthorn', 'Hawthorn East', 'Kew', 'Kew East',
    'Camberwell', 'Canterbury', 'Balwyn', 'Balwyn North', 'Surrey Hills', 'Box Hill',
    'Glen Iris', 'Malvern', 'Malvern East', 'Toorak', 'Armadale', 'Prahran', 'Windsor',
    'South Yarra', 'St Kilda', 'St Kilda East', 'St Kilda West', 'Elwood', 'Balaclava',
    'Ripponlea', 'Caulfield', 'Caulfield North', 'Caulfield South', 'Caulfield East',
    'Eaglemont', 'Ivanhoe', 'Heidelberg', 'Ivanhoe East', 'Bulleen', 'Templestowe', 'Templestowe Lower',
    'Doncaster', 'Doncaster East', 'Warrandyte', 'Blackburn', 'Blackburn North', 'Blackburn South',
    'Nunawading', 'Ringwood', 'Ringwood East', 'Mitcham', 'Vermont', 'Vermont South',
    'Wantirna', 'Wantirna South', 'Bayswater', 'Bayswater North', 'Ferntree Gully',
    'Upper Ferntree Gully', 'Boronia', 'Knoxfield', 'Rowville', 'Scoresby', 'Wheelers Hill',
    'Glen Waverley', 'Mount Waverley', 'Syndal', 'Clayton', 'Clayton South', 'Notting Hill',
    'Oakleigh', 'Huntingdale', 'Chadstone', 'Ashburton', 'Ashwood', 'Burwood', 'Burwood East',
    'Forest Hill', 'Alamein', 'Hartwell', 'Willison', 'Riversdale',
    // Outer east (Belgrave/Lilydale lines, end of the line)
    'Croydon', 'Kilsyth', 'Montrose', 'Mooroolbark', 'Lilydale', 'Chirnside Park',
    'The Basin', 'Upwey', 'Tecoma', 'Belgrave', 'Ferny Creek',
    // Inner west
    'Footscray', 'Yarraville', 'Seddon', 'Kingsville', 'Maidstone', 'Maribyrnong',
    'West Footscray', 'Braybrook', 'Tottenham', 'Sunshine', 'Sunshine North', 'Sunshine West',
    'Ascot Vale', 'Moonee Ponds', 'Essendon', 'Essendon North', 'Aberfeldie', 'Flemington',
    'Kensington', 'Newmarket', 'Airport West', 'Niddrie', 'Avondale Heights', 'Keilor',
    'Keilor East', 'Keilor Park', 'St Albans', 'Saint Albans', 'Deer Park', 'Albion', 'Ardeer', 'Ginifer',
    // Bayside / south-east (Sandringham + Frankston lines, end of the line)
    'Port Melbourne', 'South Melbourne', 'Albert Park', 'Middle Park', 'Brighton',
    'Brighton East', 'Elsternwick', 'Gardenvale', 'Hampton', 'Sandringham', 'Black Rock',
    'Beaumaris', 'Cheltenham', 'Highett', 'Moorabbin', 'Bentleigh', 'Bentleigh East',
    'McKinnon', 'Ormond', 'Glenhuntly', 'Carnegie', 'Murrumbeena', 'Hughesdale',
    'Mordialloc', 'Aspendale', 'Edithvale', 'Chelsea', 'Bonbeach', 'Carrum', 'Carrum Downs',
    'Patterson Lakes', 'Seaford', 'Frankston', 'Frankston South', 'Frankston North',
    'Mount Eliza', 'Langwarrin', 'Skye',
    // South-east (Cranbourne/Pakenham lines, end of the line)
    'Springvale', 'Noble Park', 'Dandenong', 'Keysborough', 'Dingley Village', 'Braeside',
    'Westall', 'Sandown Village', 'Cranbourne', 'Hallam', 'Narre Warren', 'Berwick',
    'Officer', 'Beaconsfield', 'Pakenham', 'East Pakenham',
    // North (Craigieburn/Upfield/Mernda/Hurstbridge lines, end of the line)
    'Broadmeadows', 'Jacana', 'Craigieburn', 'Roxburgh Park', 'Coolaroo', 'Campbellfield',
    'Tullamarine', 'Gladstone Park', 'Greenvale', 'Gowrie', 'Upfield',
    'Epping', 'South Morang', 'Mill Park', 'Bundoora', 'Thomastown', 'Lalor', 'Mernda',
    'Doreen', 'Wollert', 'Eltham', 'Diamond Creek', 'Wattle Glen', 'Hurstbridge', 'Research', 'Greensborough', 'Watsonia',
    // North-west (Sunbury line, end of the line)
    'Middle Footscray', 'Sunbury', 'Diggers Rest', 'Watergardens', 'Taylors Lakes',
    'Caroline Springs', 'Delahey', 'Sydenham', 'Hillside', 'Kealba',
    // West (Werribee/Williamstown lines, end of the line)
    'Williamstown', 'Newport', 'Spotswood', 'Altona', 'Altona North', 'Altona Meadows',
    'Laverton', 'Williams Landing', 'Point Cook', 'Werribee', 'Werribee South',
    'Hoppers Crossing', 'Tarneit', 'Truganina', 'Wyndham Vale', 'Melton', 'Melton South', 'Melton West',
  ].map((s) => s.toLowerCase())
);
