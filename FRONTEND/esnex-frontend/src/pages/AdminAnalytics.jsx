import { useEffect, useState } from "react";
import API from "../api/axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      const res = await API.get("/quizzes/analytics");
      setData(res.data);
    } catch (err) {
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#020617',
        padding: '2.5rem 1.5rem',
        color: '#f1f5f9'
      }}>
        Loading analytics...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#020617',
        padding: '2.5rem 1.5rem',
        color: '#f87171'
      }}>
        Failed to load analytics
      </div>
    );
  }

  const barData = [
    { name: "Total", value: data.totalAttempts || 0 },
    { name: "Submitted", value: data.submitted || 0 },
  ];
  const passRate = Number(data.passRate) || 0;
  const pieData = [
    { name: "Pass", value: passRate },
    { name: "Fail", value: 100 - passRate },
  ];
  const COLORS = ["#22c55e", "#ef4444"];

  return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#020617',
        padding: '2.5rem 1.5rem',
        color: '#f1f5f9'
      }}>
        <div style={{
          maxWidth: '72rem',
          margin: '0 auto'
        }}>
          <div style={{
            marginBottom: '2rem',
            borderRadius: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: '2rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          }}>
            <p style={{
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              color: '#0ea5e9'
            }}>
              Analytics
            </p>
            <h1 style={{
              marginTop: '1rem',
              fontSize: '2.25rem',
              fontWeight: '600',
              color: '#ffffff'
            }}>
              Performance insights
            </h1>
            <p style={{
              marginTop: '0.75rem',
              maxWidth: '42rem',
              color: '#94a3b8'
            }}>
              Monitor exam performance, pass rates, and attempt activity in a clean admin dashboard.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gap: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            marginBottom: '2rem'
          }}>
            <div style={{
              borderRadius: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              padding: '1.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}>
              <p style={{
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                color: '#94a3b8'
              }}>
                Total Attempts
              </p>
              <p style={{
                marginTop: '1rem',
                fontSize: '1.875rem',
                fontWeight: '600',
                color: '#ffffff'
              }}>
                {data.totalAttempts || 0}
              </p>
            </div>
            <div style={{
              borderRadius: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              padding: '1.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}>
              <p style={{
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                color: '#94a3b8'
              }}>
                Average Score
              </p>
              <p style={{
                marginTop: '1rem',
                fontSize: '1.875rem',
                fontWeight: '600',
                color: '#ffffff'
              }}>
                {(data.avgScore || 0).toFixed(1)}
              </p>
            </div>
            <div style={{
              borderRadius: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              padding: '1.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}>
              <p style={{
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                color: '#94a3b8'
              }}>
                Pass Rate
              </p>
              <p style={{
                marginTop: '1rem',
                fontSize: '1.875rem',
                fontWeight: '600',
                color: '#0ea5e9'
              }}>
                {passRate.toFixed(1)}%
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            <div style={{
              borderRadius: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              padding: '1.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#ffffff',
                marginBottom: '1rem'
              }}>
                Attempt Overview
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{
              borderRadius: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              padding: '1.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#ffffff',
                marginBottom: '1rem'
              }}>
                Pass vs Fail
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" outerRadius={110} label>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{
            marginTop: '2rem',
            borderRadius: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: '1.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '1rem'
            }}>
              Key metrics
            </h2>
            <ul style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              color: '#94a3b8',
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              <li>• Total Attempts: {data.totalAttempts || 0}</li>
              <li>• Submitted Exams: {data.submitted || 0}</li>
              <li>• Average Score: {(data.avgScore || 0).toFixed(2)}</li>
              <li>• Pass Rate: {passRate.toFixed(2)}%</li>
            </ul>
          </div>
        </div>
      </div>
  );
}

