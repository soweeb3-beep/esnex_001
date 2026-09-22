import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './EssayTypeSelector.css';

/**
 * EssayTypeSelector Component
 * 
 * Displays available essay types for English Theory part
 * User selects one essay type before starting the theory assessment
 * 
 * Props:
 *  - subject: String (e.g., 'english')
 *  - onSelect: Function(essayType) - called when user selects an essay type
 *  - onCancel: Function() - called when user wants to go back
 * 
 * Flow:
 * 1. Fetch available essay types from API
 * 2. Display radio buttons/cards for each type
 * 3. Show brief description of each essay type
 * 4. User selects one and clicks "Next"
 * 5. Call onSelect callback with chosen essay type
 */

const EssayTypeSelector = ({ subject, onSelect, onCancel }) => {
  const [essayTypes, setEssayTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Essay type descriptions
  const descriptions = {
    letter: 'Write a formal or informal letter addressing a specific topic or situation.',
    article: 'Write an article for publication, presenting your views on a topic of interest.',
    debate: 'Present arguments for or against a proposition in a structured debate format.',
    story: 'Write a creative story based on a given prompt or scenario.'
  };

  useEffect(() => {
    const fetchEssayTypes = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await axios.get(
          `/api/assessments/global/subject/${subject}/essay-types`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setEssayTypes(response.data.essayTypes || []);
        if (response.data.essayTypes && response.data.essayTypes.length > 0) {
          setSelected(response.data.essayTypes[0]);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load essay types');
        console.error('Essay types fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (subject && subject.toLowerCase() === 'english') {
      fetchEssayTypes();
    }
  }, [subject]);

  const handleNext = () => {
    if (selected && onSelect) {
      onSelect(selected);
    }
  };

  if (loading) {
    return (
      <div className="essay-type-selector">
        <div className="loading">
          <p>Loading essay types...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="essay-type-selector">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={onCancel} className="btn-cancel">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!essayTypes || essayTypes.length === 0) {
    return (
      <div className="essay-type-selector">
        <div className="no-types">
          <p>No essay types available at this time.</p>
          <button onClick={onCancel} className="btn-cancel">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="essay-type-selector">
      <div className="selector-container">
        <h2>Select an Essay Type</h2>
        <p className="subtitle">Choose which type of essay you would like to write:</p>

        <div className="essay-types-grid">
          {essayTypes.map((type) => (
            <div key={type} className={`essay-type-card ${selected === type ? 'selected' : ''}`}>
              <label className="essay-option">
                <input
                  type="radio"
                  name="essayType"
                  value={type}
                  checked={selected === type}
                  onChange={() => setSelected(type)}
                  className="radio-input"
                />
                <div className="card-content">
                  <h3 className="essay-type-name">
                    {type.charAt(0).toUpperCase() + type.slice(1)} Writing
                  </h3>
                  <p className="essay-description">{descriptions[type]}</p>
                </div>
              </label>
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button onClick={onCancel} className="btn-secondary">
            Back
          </button>
          <button 
            onClick={handleNext} 
            className="btn-primary"
            disabled={!selected}
          >
            Start Essay Section
          </button>
        </div>
      </div>
    </div>
  );
};

export default EssayTypeSelector;
