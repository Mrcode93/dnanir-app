import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as SplashScreen from 'expo-splash-screen';

interface VideoSplashProps {
    onFinish: () => void;
}

/**
 * Error Boundary for VideoSplash to prevent crashes if expo-video fails
 */
class VideoSplashErrorBoundary extends React.Component<{ onFinish: () => void; children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { onFinish: () => void; children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: any) {
        
        // If the video splash fails, just proceed to the app
        this.props.onFinish();
    }

    render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}

const VideoSplashContent: React.FC<VideoSplashProps> = ({ onFinish }) => {
    const { width, height } = useWindowDimensions();
    const [isReady, setIsReady] = useState(false);

    const player = useVideoPlayer(require('../../assets/videos/splash.mp4'), (player) => {
        player.loop = false;
        player.play();
    });

    useEffect(() => {
        const subscription = player.addListener('statusChange', (event) => {
            // Once it starts playing or is ready, we can hide the native splash
            if (event.status === 'readyToPlay' && !isReady) {
                setIsReady(true);
                // We hide the native splash screen here to transition to our video player
                SplashScreen.hideAsync().catch(() => { });
            }
        });

        const completionSubscription = player.addListener('playToEnd', () => {
            onFinish();
        });

        return () => {
            subscription.remove();
            completionSubscription.remove();
        };
    }, [player, onFinish, isReady]);

    // Fallback timeout to ensure app always opens if video hangs
    useEffect(() => {
        const timer = setTimeout(() => {
            onFinish();
        }, 6000); // 6 seconds max for splash

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <View style={styles.container}>
            <VideoView
                player={player}
                style={{ width, height }}
                contentFit="cover"
                nativeControls={false}
            />
        </View>
    );
};

export const VideoSplash: React.FC<VideoSplashProps> = (props) => (
    <VideoSplashErrorBoundary onFinish={props.onFinish}>
        <VideoSplashContent {...props} />
    </VideoSplashErrorBoundary>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#003459',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
