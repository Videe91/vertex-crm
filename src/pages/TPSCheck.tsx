import React, { useState } from 'react';
import { Phone, Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface TPSResult {
  number: string;
  isOnTPS: boolean;
  message: string;
  checkedAt: string;
}

const TPSCheck: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [result, setResult] = useState<TPSResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length >= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length >= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    setError('');
    setResult(null);
  };

  const validatePhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Call the TPS check API
      const response = await fetch('/api/tps/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check TPS status');
      }

      if (data.success && data.data) {
        const apiResult: TPSResult = {
          number: data.data.number,
          isOnTPS: data.data.isOnTPS,
          message: data.data.message,
          checkedAt: new Date(data.data.checkedAt).toLocaleString()
        };
        setResult(apiResult);
      } else {
        throw new Error('Invalid response from TPS service');
      }
    } catch (err) {
      setError('Failed to check TPS status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setPhoneNumber('');
    setResult(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 relative">
                <img 
                  src="/logo.png" 
                  alt="Vertex CRM" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Vertex CRM</h1>
                <p className="text-sm text-gray-400">TPS Number Check</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <Shield className="h-5 w-5" />
              <span className="text-sm">Secure Check</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600/20 p-4 rounded-full">
              <Phone className="h-12 w-12 text-blue-400" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">TPS Number Check</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            Check if a phone number is registered on the Telephone Preference Service (TPS) list
          </p>
        </div>

        {/* Check Form */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-400 flex items-center">
                  <XCircle className="h-4 w-4 mr-1" />
                  {error}
                </p>
              )}
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isLoading || !phoneNumber}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5 mr-2" />
                    Check TPS Status
                  </>
                )}
              </button>
              
              {(result || phoneNumber) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className={`p-4 rounded-full ${result.isOnTPS ? 'bg-red-600/20' : 'bg-green-600/20'}`}>
                  {result.isOnTPS ? (
                    <XCircle className="h-12 w-12 text-red-400" />
                  ) : (
                    <CheckCircle className="h-12 w-12 text-green-400" />
                  )}
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">
                {result.isOnTPS ? 'On TPS List' : 'Not on TPS List'}
              </h3>
              
              <p className={`text-lg mb-4 ${result.isOnTPS ? 'text-red-400' : 'text-green-400'}`}>
                {result.message}
              </p>
              
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Phone Number:</span>
                  <span className="text-white font-mono">{result.number}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Checked At:</span>
                  <span className="text-white">{result.checkedAt}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-medium ${result.isOnTPS ? 'text-red-400' : 'text-green-400'}`}>
                    {result.isOnTPS ? 'REGISTERED' : 'NOT REGISTERED'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
          <h4 className="text-lg font-semibold text-white mb-3">About TPS Check</h4>
          <div className="space-y-2 text-sm text-gray-400">
            <p>• The Telephone Preference Service (TPS) is a free service for consumers who want to opt-out of receiving unsolicited sales and marketing telephone calls.</p>
            <p>• Numbers registered on TPS should not be contacted for marketing purposes unless there is a legitimate business relationship.</p>
            <p>• This check helps ensure compliance with telemarketing regulations and consumer preferences.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800/30 backdrop-blur-sm border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-400 text-sm">
            <p>&copy; 2024 Vertex CRM. All rights reserved.</p>
            <p className="mt-1">TPS Check Service - Ensuring Compliance</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TPSCheck;
