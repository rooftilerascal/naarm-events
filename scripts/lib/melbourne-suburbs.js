// Greater Melbourne suburbs, used to filter out regional/rural Victorian towns from
// sources (like Music Victoria) that cover the whole state. Not exhaustive — extend
// this list if a legitimate Melbourne suburb turns up missing. Deliberately excludes
// Mornington Peninsula holiday towns (Rye, Sorrento, Portsea, Flinders, etc.) and
// Dandenong Ranges townships, which read more as day-trip/regional than "Melbourne".
export const MELBOURNE_METRO_SUBURBS = new Set(
  [
    // Inner Melbourne
    'Melbourne', 'Melbourne CBD', 'Southbank', 'Docklands', 'East Melbourne', 'North Melbourne',
    'West Melbourne', 'South Wharf', 'Carlton', 'Carlton North', 'Parkville',
    // Inner north
    'Fitzroy', 'Fitzroy North', 'Collingwood', 'Abbotsford', 'Clifton Hill', 'Northcote',
    'Thornbury', 'Preston', 'Reservoir', 'Brunswick', 'Brunswick East', 'Brunswick West',
    'Coburg', 'Coburg North', 'Pascoe Vale', 'Pascoe Vale South', 'Fawkner',
    // Inner east
    'Richmond', 'Cremorne', 'Burnley', 'Hawthorn', 'Hawthorn East', 'Kew', 'Kew East',
    'Camberwell', 'Canterbury', 'Balwyn', 'Balwyn North', 'Surrey Hills', 'Box Hill',
    'Glen Iris', 'Malvern', 'Malvern East', 'Toorak', 'Armadale', 'Prahran', 'Windsor',
    'South Yarra', 'St Kilda', 'St Kilda East', 'St Kilda West', 'Elwood', 'Balaclava',
    'Ripponlea', 'Caulfield', 'Caulfield North', 'Caulfield South', 'Caulfield East',
    'Eaglemont', 'Ivanhoe', 'Heidelberg', 'Ivanhoe East', 'Bulleen', 'Templestowe',
    'Doncaster', 'Doncaster East', 'Blackburn', 'Nunawading', 'Ringwood', 'Ringwood East',
    'Mitcham', 'Vermont', 'Vermont South', 'Wantirna', 'Wantirna South', 'Bayswater',
    'Ferntree Gully', 'Boronia', 'Knoxfield', 'Rowville', 'Scoresby', 'Wheelers Hill',
    'Glen Waverley', 'Mount Waverley', 'Clayton', 'Clayton South', 'Notting Hill', 'Oakleigh',
    'Huntingdale', 'Chadstone', 'Ashburton', 'Ashwood', 'Burwood', 'Burwood East',
    'Blackburn North', 'Blackburn South', 'Forest Hill', 'Whitehorse',
    // Inner west
    'Footscray', 'Yarraville', 'Seddon', 'Kingsville', 'Maidstone', 'Maribyrnong',
    'West Footscray', 'Braybrook', 'Sunshine', 'Sunshine North', 'Sunshine West',
    'Ascot Vale', 'Moonee Ponds', 'Essendon', 'Essendon North', 'Aberfeldie', 'Flemington',
    'Kensington', 'Newmarket', 'Airport West', 'Niddrie', 'Avondale Heights', 'Keilor',
    'Keilor East', 'St Albans', 'Saint Albans', 'Deer Park', 'Albion', 'Ardeer',
    // Bayside / south-east
    'Port Melbourne', 'South Melbourne', 'Albert Park', 'Middle Park', 'Brighton',
    'Brighton East', 'Hampton', 'Sandringham', 'Black Rock', 'Beaumaris', 'Cheltenham',
    'Highett', 'Moorabbin', 'Bentleigh', 'Bentleigh East', 'McKinnon', 'Ormond',
    'Mordialloc', 'Aspendale', 'Chelsea', 'Bonbeach', 'Carrum', 'Carrum Downs',
    'Patterson Lakes', 'Seaford', 'Frankston', 'Frankston South', 'Frankston North',
    'Mount Eliza', 'Langwarrin', 'Skye', 'Cranbourne', 'Clyde', 'Clyde North',
    'Braeside', 'Dingley Village', 'Springvale', 'Noble Park', 'Dandenong', 'Keysborough',
    'Hallam', 'Narre Warren', 'Berwick', 'Pakenham', 'Officer', 'Beaconsfield',
    // Outer east / Yarra Ranges (metro end only)
    'Croydon', 'Kilsyth', 'Montrose', 'Mooroolbark', 'Lilydale', 'Chirnside Park',
    'Bayswater North', 'The Basin', 'Upwey', 'Belgrave', 'Ferny Creek',
    // North / Hume / Whittlesea (metro end only)
    'Broadmeadows', 'Craigieburn', 'Roxburgh Park', 'Meadow Heights', 'Coolaroo',
    'Campbellfield', 'Tullamarine', 'Gladstone Park', 'Greenvale', 'Sunbury',
    'Epping', 'South Morang', 'Mill Park', 'Bundoora', 'Thomastown', 'Lalor',
    'Whittlesea', 'Mernda', 'Doreen', 'Wollert', 'Kalkallo',
    // West / Wyndham / Melton / Hobsons Bay (metro end only)
    'Williamstown', 'Newport', 'Spotswood', 'Altona', 'Altona North', 'Altona Meadows',
    'Laverton', 'Point Cook', 'Werribee', 'Werribee South', 'Hoppers Crossing',
    'Tarneit', 'Truganina', 'Wyndham Vale', 'Melton', 'Melton South', 'Melton West',
    'Caroline Springs', 'Taylors Lakes', 'Delahey', 'Sydenham', 'Hillside',
    // Manningham / Banyule (further)
    'Warrandyte', 'Eltham', 'Greensborough', 'Watsonia', 'Diamond Creek', 'Research',
  ].map((s) => s.toLowerCase())
);
