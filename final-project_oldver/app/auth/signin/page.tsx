'use client';

import { signIn } from 'next-auth/react';
import Image from 'next/image';

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm px-6">
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <Image
                src="/emptywallet.png"
                alt="Empty wallet"
                width={120}
                height={120}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900">記帳助手</h1>
            <p className="text-sm text-gray-600">登入以查看您的記帳記錄</p>
          </div>
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
          >
            使用 Google 登入
          </button>
          <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-gray-700">
            <p className="mb-2">
              💬 本網頁可與 LINE Bot 連接，方便您在手機與電腦雙邊記帳，並提供消費趨勢分析。
            </p>
            <p className="text-xs text-gray-600">
              LINE 帳號：<span className="font-mono font-semibold">@757cbqbh</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

