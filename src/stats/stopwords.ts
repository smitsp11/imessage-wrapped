/** Common words that say nothing about a person. Words under 3 letters are already dropped. */
export const STOPWORDS = new Set([
  'the', 'and', 'you', 'that', 'for', 'are', 'was', 'but', 'not', 'have', 'with', 'this', 'just', 'what',
  'its', "it's", 'can', 'get', 'all', 'your', 'yeah', 'yes', 'out', 'now', 'how', 'when', 'where', 'who',
  'why', 'will', 'would', 'there', 'they', 'them', 'then', 'than', 'been', 'about', 'one', 'did', 'didn',
  "didn't", 'don', "don't", 'dont', "i'm", "i'll", "i've", 'too', 'also', 'some', 'more', 'got', 'his',
  'her', 'she', 'him', 'our', 'from', 'were', 'had', 'has', 'any', 'into', 'could', 'should', 'really',
  'okay', 'gonna', 'wanna', 'like', 'know', 'think', 'going', 'here', 'well', 'which', 'their', 'only',
  'very', 'even', 'because', 'want', 'need', 'make', 'see', 'say', 'said', 'way', 'back', 'still', 'thing',
  'things', 'today', 'time', "that's", "can't", 'cant', 'thats', 'lemme', 'u', 'ur',
  'doesn', "doesn't", 'doesnt', "isn't", 'isnt', "won't", 'wont', "wasn't", 'wasnt', "aren't", 'arent',
  "haven't", 'havent', "couldn't", 'couldnt', "wouldn't", 'wouldnt', "shouldn't", 'shouldnt', "you're",
  'youre', "we're", "they're", 'theyre', "let's", 'lets', "what's", 'whats', "there's", 'theres', "he's",
  "she's", "i'd", "you'll", 'ill', 'ive',
])
