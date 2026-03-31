import React from 'react';
import { Lock } from 'lucide-react';
export function TrustPrivacyBlock() {
  return (
    <div className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <div className="border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-center text-center md:text-left gap-4 bg-linkedin-bg/50">
          <div className="p-3 bg-white rounded-full border border-gray-200 shadow-sm">
            <Lock className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600">
              We only read your public LinkedIn profile. No login required. No
              connections accessed.
              <span className="block md:inline md:ml-1">
                Unsubscribe anytime.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>);

}