import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

type AutoHideScrollViewProps = ScrollViewProps & {
  fadeDelay?: number;
};

const MIN_THUMB_HEIGHT = 34;
const TRACK_INSET = 4;

export function AutoHideScrollView({
  children,
  style,
  contentContainerStyle,
  fadeDelay = 900,
  onLayout,
  onContentSizeChange,
  onScroll,
  onTouchStart,
  onTouchEnd,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollBegin,
  onMomentumScrollEnd,
  ...scrollViewProps
}: AutoHideScrollViewProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const hideIndicator = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const showIndicator = useCallback(
    (hideAfterDelay = true) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      opacity.stopAnimation();
      opacity.setValue(1);
      if (hideAfterDelay) {
        hideTimer.current = setTimeout(hideIndicator, fadeDelay);
      }
    },
    [fadeDelay, hideIndicator, opacity],
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      opacity.stopAnimation();
    };
  }, [opacity]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
    onLayout?.(event);
  };

  const handleContentSizeChange = (width: number, height: number) => {
    setContentHeight(height);
    onContentSizeChange?.(width, height);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollOffset(Math.max(0, event.nativeEvent.contentOffset.y));
    showIndicator(false);
    onScroll?.(event);
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    showIndicator();
    onTouchStart?.(event);
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    showIndicator();
    onTouchEnd?.(event);
  };

  const handleScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    showIndicator(false);
    onScrollBeginDrag?.(event);
  };

  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    showIndicator();
    onScrollEndDrag?.(event);
  };

  const handleMomentumScrollBegin = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    showIndicator(false);
    onMomentumScrollBegin?.(event);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    showIndicator();
    onMomentumScrollEnd?.(event);
  };

  const isScrollable = viewportHeight > 0 && contentHeight > viewportHeight + 1;
  const trackHeight = Math.max(0, viewportHeight - TRACK_INSET * 2);
  const thumbHeight = isScrollable
    ? Math.max(MIN_THUMB_HEIGHT, (viewportHeight / contentHeight) * trackHeight)
    : 0;
  const boundedThumbHeight = Math.min(trackHeight, thumbHeight);
  const maxScrollOffset = Math.max(1, contentHeight - viewportHeight);
  const maxThumbOffset = Math.max(0, trackHeight - boundedThumbHeight);
  const thumbOffset = Math.min(
    maxThumbOffset,
    Math.max(0, (scrollOffset / maxScrollOffset) * maxThumbOffset),
  );

  const wrapperStyle = style as StyleProp<ViewStyle>;

  return (
    <View style={[styles.container, wrapperStyle]} onLayout={handleLayout}>
      <ScrollView
        {...scrollViewProps}
        style={styles.scrollView}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={scrollViewProps.scrollEventThrottle ?? 16}
      >
        {children}
      </ScrollView>

      {isScrollable && (
        <View pointerEvents="none" style={styles.track}>
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: colors.tint,
                height: boundedThumbHeight,
                opacity,
                transform: [{ translateY: thumbOffset }],
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
  },
  track: {
    position: "absolute",
    top: TRACK_INSET,
    right: 3,
    bottom: TRACK_INSET,
    width: 5,
  },
  thumb: {
    width: 5,
    borderRadius: 3,
  },
});