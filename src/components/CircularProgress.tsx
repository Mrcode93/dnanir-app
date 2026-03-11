import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { type AppTheme } from '../utils/theme-constants';

interface CircularProgressProps {
    size: number;
    strokeWidth: number;
    progress: number;
    theme: AppTheme;
    color?: string;
    backgroundColor?: string;
    children?: React.ReactNode;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
    size,
    strokeWidth,
    progress,
    theme,
    color,
    backgroundColor,
    children
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size}>
                {/* Background Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={backgroundColor || 'rgba(255, 255, 255, 0.1)'}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                {/* Progress Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color || theme.colors.primary}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            {children && (
                <View style={{ position: 'absolute' }}>
                    {children}
                </View>
            )}
        </View>
    );
};
