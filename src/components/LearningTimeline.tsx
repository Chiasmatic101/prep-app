import React, { useState } from 'react';
import { Clock, Brain, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface LearningTimelineProps {
  learningPhase?: number;
  responses?: {
    schoolStart: string;
    homeworkTime: string;
    naturalWake: string;
    focusTime: string;
  };
  syncScore?: number;
  alignmentScores?: {
    school: number;
    study: number;
  };
}

const LearningTimeline: React.FC<LearningTimelineProps> = ({ 
  learningPhase = 14, 
  responses, 
  syncScore = 75,
  alignmentScores 
}) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const generateLearningCurve = (phi: number) => {
    const omega = 2 * Math.PI / 24;
    const curve = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const circadian = 0.5 * (1 + Math.cos(omega * (hour - phi)));
      const sigma = 2;
      const practiceBump = Math.exp(-Math.pow(hour - 17, 2) / (2 * sigma * sigma));
      const beta = 0.2;
      const readiness = (1 - beta) * circadian + beta * practiceBump;
      const percentage = Math.max(15, Math.min(95, readiness * 100));
      
      curve.push({
        hour,
        readiness: Math.round(percentage),
        isPeak: percentage > 80,
        isLow: percentage < 40
      });
    }
    
    return curve;
  };

  const getScheduleBlocks = () => {
    if (!responses) return [];
    
    const blocks = [];
    const schoolStartMap: Record<string, number> = {
      'Before 7:30 AM': 7.25,
      '7:30–8:00 AM': 7.75,
      'After 8:00 AM': 8.5
    };
    
    const schoolStart = schoolStartMap[responses.schoolStart] || 7.75;
    blocks.push({
      start: schoolStart,
      end: schoolStart + 6.5,
      type: 'school',
      label: 'School',
      color: 'bg-blue-500'
    });
    
    const homeworkMap: Record<string, number> = {
      'Right after school': schoolStart + 7,
      'After dinner': 19,
      'Late at night': 21,
      'Depends': schoolStart + 7
    };
    
    const studyStart = homeworkMap[responses.homeworkTime] || 19;
    blocks.push({
      start: studyStart,
      end: studyStart + 1.5,
      type: 'study',
      label: 'Study Time',
      color: 'bg-purple-500'
    });
    
    return blocks;
  };

  const formatTime = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.floor((hour % 1) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getPerformanceColor = (readiness: number) => {
    if (readiness >= 80) return 'bg-green-400';
    if (readiness >= 65) return 'bg-yellow-400';  
    if (readiness >= 45) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const learningCurve = generateLearningCurve(learningPhase);
  const scheduleBlocks = getScheduleBlocks();
  const peakHours = learningCurve.filter(h => h.isPeak);
  const lowHours = learningCurve.filter(h => h.isLow);

  return (
    <div className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Your Daily Learning Rhythm
        </h3>
        <div className="text-sm text-gray-600">
          Peak: {formatTime(learningPhase)}
        </div>
      </div>

      <div className="relative mb-6">
        <div className="flex justify-between mb-2 text-xs text-gray-500">
          {[0, 6, 12, 18, 24].map(hour => (
            <span key={hour} className="flex flex-col items-center">
              <span>{hour}:00</span>
              <span className="text-xs text-gray-400">
                {hour === 0 || hour === 24 ? 'Mid' : hour === 6 ? 'Dawn' : hour === 12 ? 'Noon' : 'Eve'}
              </span>
            </span>
          ))}
        </div>

        <div className="relative h-16 bg-gray-100 rounded-lg overflow-hidden mb-4">
          <div className="absolute inset-0 flex">
            {learningCurve.map((hourData, idx) => (
              <div
                key={idx}
                className="flex-1 relative cursor-pointer transition-all hover:scale-110"
                onMouseEnter={() => setHoveredHour(idx)}
                onMouseLeave={() => setHoveredHour(null)}
              >
                <div
                  className={`${getPerformanceColor(hourData.readiness)} transition-all duration-200`}
                  style={{
                    height: `${(hourData.readiness / 100) * 100}%`,
                    opacity: hoveredHour === idx ? 1 : 0.8
                  }}
                />
                
                {hoveredHour === idx && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
                    <div className="bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      {formatTime(idx)}: {hourData.readiness}%
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {scheduleBlocks.map((block, idx) => (
            <div
              key={idx}
              className={`absolute top-1 h-14 ${block.color} opacity-60 rounded border-2 border-white shadow-md`}
              style={{
                left: `${(block.start / 24) * 100}%`,
                width: `${((block.end - block.start) / 24) * 100}%`
              }}
              title={`${block.label}: ${formatTime(block.start)} - ${formatTime(block.end)}`}
            >
              <div className="text-white text-xs font-medium p-1 truncate">
                {block.label}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <span>Peak (80%+)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <span>High (65-79%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-400 rounded"></div>
            <span>Moderate (45-64%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <span>Low (&lt;45%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-green-800">Peak Learning Times</span>
          </div>
          <div className="space-y-1 text-sm text-green-700">
            {peakHours.length > 0 ? (
              peakHours.slice(0, 3).map((hour, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{formatTime(hour.hour)}</span>
                  <span>{hour.readiness}%</span>
                </div>
              ))
            ) : (
              <div>No peak times identified</div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-blue-800">Schedule Alignment</span>
          </div>
          {alignmentScores ? (
            <div className="space-y-1 text-sm text-blue-700">
              <div className="flex justify-between">
                <span>School:</span>
                <span>{alignmentScores.school}%</span>
              </div>
              <div className="flex justify-between">
                <span>Study:</span>
                <span>{alignmentScores.study}%</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Overall:</span>
                <span>{syncScore}%</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-blue-700">Complete assessment to see alignment</div>
          )}
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-orange-600" />
            <span className="font-semibold text-orange-800">Avoid These Times</span>
          </div>
          <div className="space-y-1 text-sm text-orange-700">
            {lowHours.length > 0 ? (
              lowHours.slice(0, 3).map((hour, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{formatTime(hour.hour)}</span>
                  <span>{hour.readiness}%</span>
                </div>
              ))
            ) : (
              <div>No significant low periods</div>
            )}
          </div>
        </div>
      </div>

      {syncScore < 70 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-purple-800">Optimization Suggestions</span>
          </div>
          <div className="text-sm text-purple-700 space-y-1">
            {peakHours.length > 0 && (
              <div>• Schedule your most challenging subjects around {formatTime(peakHours[0].hour)}</div>
            )}
            {responses && responses.homeworkTime === 'Late at night' && (
              <div>• Consider moving study time earlier to align with your natural rhythm</div>
            )}
            {alignmentScores && alignmentScores.school < 50 && (
              <div>• Focus on review sessions during your peak times to compensate for low school alignment</div>
            )}
            <div>• Take breaks during your low-performance periods ({lowHours[0] ? formatTime(lowHours[0].hour) : 'afternoon'})</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 mt-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-blue-500 opacity-60 rounded"></div>
            <span>School Schedule</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-purple-500 opacity-60 rounded"></div>
            <span>Study Time</span>
          </div>
        </div>
        <div>Hover over timeline for details</div>
      </div>
    </div>
  );
};

export default LearningTimeline;