import { useState, useEffect } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts'

interface AnalyzedReview {
  text: string
  polarity: number
  health_score: number
}

interface DashboardData {
  business_name: string
  business_health_score: number
  total_reviews: number
  analyzed_reviews: AnalyzedReview[]
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444']

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false) // Changed to false initially
  const [error, setError] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [searchedName, setSearchedName] = useState('')

  useEffect(() => {
    if (!searchedName) {
      setLoading(false)
      setData(null)
      return
    }

    // Show loading spinner immediately when search starts
    setLoading(true)
    setError('')

    fetch(`http://127.0.0.1:8001/fetch-and-analyze?business_name=${encodeURIComponent(searchedName)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch data')
        return response.json()
      })
      .then((fetchedData) => {
        console.log("Data received:", fetchedData) // Debug log
        setData(fetchedData)
        setLoading(false) // IMPORTANT: Stop loading here
      })
      .catch((err) => {
        console.error("Fetch error:", err)
        setError(err.message)
        setLoading(false) // IMPORTANT: Stop loading on error too
      })
  }, [searchedName])

  // 1. Welcome Screen (No search yet)
  if (!searchedName && !data) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">Instant Review Dashboard</h1>
          <p className="text-xl text-gray-600 mb-8">Analyze business reviews with AI-powered sentiment analysis</p>
          <div className="bg-white rounded-lg shadow-lg p-8">
            <input 
              type="text" 
              placeholder="Enter business name (e.g., Starbucks)" 
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  setSearchedName(businessName)
                }
              }}
            />
            <button 
              onClick={() => setSearchedName(businessName)}
              className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg"
            >
              Analyze Reviews
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2. Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-2xl text-gray-600 font-semibold animate-pulse">Analyzing Reviews...</div>
      </div>
    )
  }

  // 3. Error Screen
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <div className="text-xl text-red-600 mb-4">Error: {error}</div>
        <button onClick={() => { setSearchedName(''); setError(''); }} className="text-blue-600 underline">Go Back</button>
      </div>
    )
  }

  // 4. Dashboard Screen (Data is ready)
  if (!data) return null

  const getSentimentCategory = (score: number) => {
    if (score >= 70) return 'Positive'
    if (score >= 40) return 'Neutral'
    return 'Negative'
  }

  const sentimentDistribution = data.analyzed_reviews.reduce((acc: any, review) => {
    const category = getSentimentCategory(review.health_score)
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {})

  const pieData = Object.keys(sentimentDistribution).map((key) => ({
    name: key,
    value: sentimentDistribution[key]
  }))

  const barData = data.analyzed_reviews.map((review, index) => ({
    name: `Review ${index + 1}`,
    score: review.health_score,
    polarity: review.polarity
  }))

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-100'
    if (score >= 40) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Instant Review Dashboard</h1>
          <button 
            onClick={() => { setSearchedName(''); setData(null); setBusinessName(''); }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
          >
            New Search
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8 flex gap-4">
          <input 
            type="text" 
            placeholder="Enter another business name..." 
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => { if (e.key === 'Enter') setSearchedName(businessName) }}
          />
          <button 
            onClick={() => setSearchedName(businessName)}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Analyze
          </button>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Health Score for: {data.business_name}</h2>
            <div className={`inline-block text-7xl font-bold px-8 py-6 rounded-full ${getScoreColor(data.business_health_score)}`}>
              {data.business_health_score}/100
            </div>
            <p className="mt-4 text-gray-600 text-lg">Based on {data.total_reviews} reviews</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Sentiment Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Individual Review Scores</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="#10B981" name="Health Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Reviews List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Detailed Reviews</h2>
          {data.analyzed_reviews.map((review, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <p className="text-gray-800 mb-3 italic text-lg">"{review.text}"</p>
              <div className="flex gap-4 flex-wrap">
                <span className={`px-4 py-2 rounded-full font-semibold ${getScoreColor(review.health_score)}`}>
                  Score: {review.health_score}/100
                </span>
                <span className="px-4 py-2 rounded-full bg-gray-200 text-gray-700">
                  Polarity: {review.polarity.toFixed(2)}
                </span>
                <span className={`px-4 py-2 rounded-full font-semibold ${
                  review.health_score >= 70 ? 'bg-green-100 text-green-700' :
                  review.health_score >= 40 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {getSentimentCategory(review.health_score)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App