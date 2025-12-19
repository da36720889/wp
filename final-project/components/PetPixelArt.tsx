'use client';

import { Box } from '@mui/material';
import Image from 'next/image';
import { useState, useEffect } from 'react';

interface PetPixelArtProps {
  stage: string;
  state: string;
  hunger: number;
  health: number;
  level: number;
  size?: number;
}

// 使用實際圖片文件顯示寵物，帶有微動畫效果和眨眼動畫
const PetPixelArt = ({ stage, state, hunger, health, level, size = 120 }: PetPixelArtProps) => {
  const [isBlinking, setIsBlinking] = useState(false);

  // 眨眼動畫：每 3-5 秒眨眼一次
  useEffect(() => {
    if (health <= 0 || stage === 'dead' || stage === 'egg') {
      setIsBlinking(false);
      return; // 死亡或蛋階段不眨眼
    }

    // 只在正常狀態時眨眼（非 eating, hungry, sick, dying）
    if (state === 'eating' || hunger <= 75 || health <= 50) {
      setIsBlinking(false);
      return;
    }

    // 設置第一次眨眼（延遲一下，避免立即眨眼）
    const initialDelay = setTimeout(() => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 200); // 眨眼持續 200ms
    }, 2000 + Math.random() * 1000); // 2-3 秒後第一次眨眼

    // 設置定期眨眼
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 200); // 眨眼持續 200ms
    }, 3000 + Math.random() * 2000); // 每 3-5 秒隨機眨眼一次

    return () => {
      clearTimeout(initialDelay);
      clearInterval(blinkInterval);
    };
  }, [health, stage, state, hunger]);

  // 根據寵物狀態選擇基礎圖片文件名
  const getBaseImagePath = (): string => {
    // 如果健康度歸0或階段是dead，顯示死亡圖片
    if (health <= 0 || stage === 'dead') {
      return '/pic/pet_fig/dead.jpg';
    }

    // 處理 egg 階段：根據等級決定是 egg0 還是 egg1
    // level 1 顯示 egg0，level 2+ 顯示 egg1（在進化到 baby 之前）
    if (stage === 'egg') {
      if (level >= 2) {
        return '/pic/pet_fig/egg1.jpg';
      } else {
        return '/pic/pet_fig/egg0.jpg';
      }
    }

    // 對於其他階段（baby, child, adult），需要根據狀態和飽足感選擇圖片
    // 優先級：dying (health <= 25) > sick (health <= 50) > feed (eating) > hungry (hunger <= 75) > normal
    
    // 檢查是否垂死（健康度 <= 25）
    if (health <= 25) {
      return `/pic/pet_fig/${stage}_dying.jpg`;
    }
    
    // 檢查是否生病（健康度 <= 50）
    if (health <= 50) {
      return `/pic/pet_fig/${stage}_sick.jpg`;
    }
    
    // 檢查是否在餵食狀態（優先於飢餓狀態）
    // 記帳時會顯示 _feed 圖片
    if (state === 'eating') {
      return `/pic/pet_fig/${stage}_feed.jpg`;
    }
    
    // 檢查是否飢餓（飽足感 <= 75）
    if (hunger <= 75) {
      return `/pic/pet_fig/${stage}_hungry.jpg`;
    }
    
    // 正常狀態（idle 或 happy）：使用基礎圖片
    // happy 狀態也使用基礎圖片，因為 happy 只是狀態標記，不是圖片變體
    return `/pic/pet_fig/${stage}.jpg`;
  };

  const baseImagePath = getBaseImagePath();
  const eyeImagePath = (stage === 'baby' || stage === 'child' || stage === 'adult') 
    ? `/pic/pet_fig/${stage}_eye.png` 
    : null;
  
  // 調試：記錄圖片路徑（開發環境）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Pet image:', {
        baseImage: baseImagePath,
        eyeImage: eyeImagePath,
        stage,
        state,
        hunger,
        health,
        isBlinking,
      });
    }
  }, [baseImagePath, eyeImagePath, stage, state, hunger, health, isBlinking]);
  
  // 根據狀態決定動畫類型
  const getAnimation = (): string => {
    // 死亡狀態：無動畫
    if (health <= 0 || stage === 'dead') {
      return 'none';
    }
    
    // 垂死狀態：輕微顫抖
    if (health <= 25) {
      return 'shake 0.5s ease-in-out infinite';
    }
    
    // 生病狀態：緩慢浮動
    if (health <= 50) {
      return 'floatSlow 3s ease-in-out infinite';
    }
    
    // 飢餓狀態：輕微搖擺
    if (hunger <= 75) {
      return 'sway 2s ease-in-out infinite';
    }
    
    // 餵食狀態：輕微跳動
    if (state === 'eating') {
      return 'bounce 0.6s ease-in-out infinite';
    }
    
    // 正常狀態：輕微浮動（呼吸效果）
    return 'float 2.5s ease-in-out infinite';
  };

  return (
    <Box
      sx={{
        width: size,
        height: size,
        position: 'relative',
        background: '#E8F5E9',
        borderRadius: '12px',
        border: '3px solid #333',
        borderStyle: 'double',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 15px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          animation: getAnimation(),
          '@keyframes float': {
            '0%, 100%': {
              transform: 'translateY(0px)',
            },
            '50%': {
              transform: 'translateY(-8px)',
            },
          },
          '@keyframes floatSlow': {
            '0%, 100%': {
              transform: 'translateY(0px)',
            },
            '50%': {
              transform: 'translateY(-5px)',
            },
          },
          '@keyframes sway': {
            '0%, 100%': {
              transform: 'rotate(0deg) translateY(0px)',
            },
            '25%': {
              transform: 'rotate(-2deg) translateY(-3px)',
            },
            '75%': {
              transform: 'rotate(2deg) translateY(-3px)',
            },
          },
          '@keyframes bounce': {
            '0%, 100%': {
              transform: 'translateY(0px) scale(1)',
            },
            '50%': {
              transform: 'translateY(-10px) scale(1.05)',
            },
          },
          '@keyframes shake': {
            '0%, 100%': {
              transform: 'translateX(0px)',
            },
            '25%': {
              transform: 'translateX(-3px)',
            },
            '75%': {
              transform: 'translateX(3px)',
            },
          },
        }}
      >
        {/* 基礎圖片 */}
        <Image
          src={baseImagePath}
          alt={`Pet ${stage} ${state}`}
          width={size}
          height={size}
          style={{
            objectFit: 'contain',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          unoptimized
          onError={(e) => {
            console.error('Failed to load pet base image:', baseImagePath, 'stage:', stage, 'state:', state);
          }}
        />
        
        {/* 眨眼圖片（覆蓋層，始終渲染但通過 opacity 控制顯示） */}
        {eyeImagePath && (stage === 'baby' || stage === 'child' || stage === 'adult') && (
          <Image
            src={eyeImagePath}
            alt={`Pet ${stage} blinking`}
            width={size}
            height={size}
            style={{
              objectFit: 'contain',
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1,
              opacity: isBlinking ? 1 : 0,
              transition: 'opacity 0.05s ease-in-out',
              pointerEvents: 'none', // 不影響點擊事件
            }}
            unoptimized
            onError={(e) => {
              console.error('Failed to load pet eye image:', eyeImagePath);
            }}
          />
        )}
      </Box>
    </Box>
  );
};

export default PetPixelArt;
