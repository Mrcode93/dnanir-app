import React from 'react';
import {
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
    Platform,
    Text,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAppTheme } from '../utils/theme';

interface CustomDatePickerProps {
    value: Date;
    mode?: 'date' | 'time' | 'datetime';
    onChange: (event: DateTimePickerEvent, date?: Date) => void;
    onClose: () => void;
    minimumDate?: Date;
    maximumDate?: Date;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    value,
    mode = 'date',
    onChange,
    onClose,
    minimumDate,
    maximumDate,
}) => {
    const { theme } = useAppTheme();
    const [tempDate, setTempDate] = React.useState(value);

    if (Platform.OS === 'android') {
        return (
            <DateTimePicker
                value={value}
                mode={mode}
                display="default"
                onChange={onChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
            />
        );
    }

    const handleConfirm = () => {
        onChange({ type: 'set', nativeEvent: { timestamp: tempDate.getTime() } } as DateTimePickerEvent, tempDate);
        onClose();
    };

    // iOS Implementation with Modal and Spinner
    return (
        <Modal
            transparent
            animationType="slide"
            visible={true}
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={[styles.modalContent, { backgroundColor: theme.colors.surfaceCard }]}>
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={[styles.doneText, { color: theme.colors.textSecondary }]}>إلغاء</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleConfirm}>
                            <Text style={[styles.doneText, { color: theme.colors.primary }]}>تم</Text>
                        </TouchableOpacity>
                    </View>
                    <DateTimePicker
                        value={tempDate}
                        mode={mode}
                        display="spinner"
                        onChange={(event, date) => {
                            if (date) setTempDate(date);
                        }}
                        minimumDate={minimumDate}
                        maximumDate={maximumDate}
                        style={styles.picker}
                        textColor={theme.colors.textPrimary}
                    />
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        borderRadius: 24,
        paddingBottom: 10,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    doneText: {
        fontSize: 17,
        fontWeight: '700',
    },
    picker: {
        height: 220,
    },
});
