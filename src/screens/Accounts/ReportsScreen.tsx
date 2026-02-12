import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView, Platform, PermissionsAndroid,
    useColorScheme, Dimensions, StatusBar
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { PieChart } from 'react-native-svg-charts';
import { Text as SvgText } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import apiClient from '../../api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- THEME DEFINITIONS ---
const LightColors = {
    primary: '#008080',    // Teal
    background: '#F2F5F8', 
    cardBg: '#FFFFFF',
    textMain: '#263238',
    textSub: '#546E7A',
    border: '#CFD8DC',
    success: '#43A047',
    danger: '#E53935',
    blue: '#1E88E5',
    warning: '#F59E0B',
    inputBg: '#F8F9FA',
    segmentBg: '#F5F5F5'
};

const DarkColors = {
    primary: '#008080',
    background: '#121212',
    cardBg: '#1E1E1E',
    textMain: '#E0E0E0',
    textSub: '#B0B0B0',
    border: '#333333',
    success: '#66BB6A',
    danger: '#EF5350',
    blue: '#42A5F5',
    warning: '#FFB74D',
    inputBg: '#2C2C2C',
    segmentBg: '#2C2C2C'
};

// --- Helper: Format Currency ---
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

const ReportsScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const viewShotRef = useRef(null);

    // Theme Hook
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const COLORS = isDark ? DarkColors : LightColors;

    const [reportData, setReportData] = useState({ debit: 0, credit: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState('daily');
    const [displayDate, setDisplayDate] = useState('');
    const [dateRange, setDateRange] = useState({ start: null, end: null });
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('start');

    const reportColors = {
        debit: COLORS.danger,
        credit: COLORS.success,
    };

    const fetchReportData = useCallback(async () => {
        if (activePeriod === 'custom' && (!dateRange.start || !dateRange.end)) {
            setReportData({ debit: 0, credit: 0 });
            return;
        }

        setIsLoading(true);
        let queryString = '/reports/summary?';
        if (activePeriod === 'custom' && dateRange.start && dateRange.end) {
            queryString += `startDate=${dateRange.start}&endDate=${dateRange.end}`;
        } else {
            queryString += `period=${activePeriod}`;
        }

        try {
            const response = await apiClient.get(queryString);
            setReportData(response.data);
        } catch (error) {
            Alert.alert("Error", "Could not fetch report data.");
        } finally {
            setIsLoading(false);
        }
    }, [activePeriod, dateRange]);

    useEffect(() => {
        if (isFocused) {
            fetchReportData();
        }
    }, [isFocused, fetchReportData]);

    useEffect(() => {
        const getFormattedDate = (date) => date.toLocaleDateString('en-GB');
        if (activePeriod === 'daily') {
            setDisplayDate(getFormattedDate(new Date()));
        } else if (activePeriod === 'monthly') {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            setDisplayDate(`${getFormattedDate(startOfMonth)} - ${getFormattedDate(endOfMonth)}`);
        } else if (activePeriod === 'overall') {
            setDisplayDate('Overall Report');
        } else if (activePeriod === 'custom' && dateRange.start && dateRange.end) {
            const formatDate = (isoDate) => {
                const [y, m, d] = isoDate.split('-');
                return `${d}/${m}/${y}`;
            }
            setDisplayDate(`${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`);
        } else {
            setDisplayDate('');
        }
    }, [activePeriod, dateRange]);

    const handlePeriodChange = (period) => {
        setActivePeriod(period);
        setDateRange({ start: null, end: null });
    };

    const showDatePicker = (mode) => {
        setDatePickerMode(mode);
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => setDatePickerVisibility(false);

    const handleConfirmDate = (date) => {
        const formattedDate = date.toISOString().split('T')[0];
        hideDatePicker();
        if (datePickerMode === 'start') {
            setDateRange(prev => ({ ...prev, start: formattedDate, end: null }));
        } else {
            setDateRange(prev => ({ ...prev, end: formattedDate }));
        }
        setActivePeriod('custom');
    };
    
    const requestStoragePermission = async () => {
        if (Platform.OS !== 'android' || Platform.Version >= 33) return true;
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            return false;
        }
    };
    
    const grossTotal = Number(reportData.debit) + Number(reportData.credit);
    const netTotal = Number(reportData.credit) - Number(reportData.debit);

    const downloadReport = async () => {
        if (!(await requestStoragePermission())) {
            Alert.alert("Permission Denied", "Storage permission is required to download reports.");
            return;
        }
        try {
            const imageUri = await viewShotRef.current.capture();
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0; background-color: #fff; }
                        .report-container { width: 100%; max-width: 800px; margin: auto; padding: 20px; box-sizing: border-box; }
                        .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                        .school-name { font-size: 24px; font-weight: bold; }
                        .managed-by { font-size: 14px; color: #777; }
                        .report-title { font-size: 20px; font-weight: bold; margin: 20px 0; }
                        .chart-container { text-align: center; margin: 20px 0; }
                        .chart-container img { max-width: 90%; height: auto; max-height: 40vh; object-fit: contain; }
                        .summary-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .summary-table td { padding: 12px 5px; border-bottom: 1px solid #eee; }
                        .summary-table .label { font-weight: 500; }
                        .summary-table .amount { text-align: right; font-weight: bold; }
                        .total-row .label, .total-row .amount { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <div class="school-name">Vivekanand Public School</div>
                            <div class="managed-by">Managed by Vivekananda Education Center</div>
                        </div>
                        <div class="report-title">${displayDate} Financial Report</div>
                        <div class="chart-container">
                            <img src="${imageUri}" alt="Financial Report Chart"/>
                        </div>
                        <table class="summary-table">
                            <tr><td class="label">Debit</td><td class="amount">- ₹${formatCurrency(reportData.debit)}</td></tr>
                            <tr><td class="label">Credit</td><td class="amount">+ ₹${formatCurrency(reportData.credit)}</td></tr>
                            <tr class="total-row"><td class="label">Total Amount</td><td class="amount">₹${formatCurrency(netTotal)}</td></tr>
                        </table>
                    </div>
                </body>
                </html>
            `;
            
            const options = { 
                html: htmlContent, 
                fileName: `Financial_Report_${displayDate.replace(/ /g, '_').replace(/\//g, '-')}`, 
                directory: 'Download'
            };
            const file = await RNHTMLtoPDF.convert(options);
            const destinationPath = `${RNFS.DownloadDirectoryPath}/${file.fileName}.pdf`;
            await RNFS.moveFile(file.filePath, destinationPath);
            Alert.alert("Success", `Report saved to your Downloads folder.`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            Alert.alert("Error", "Failed to generate or save the report.");
        }
    };

    const pieData = [
        { key: 'debit', value: Number(reportData.debit), svg: { fill: reportColors.debit } },
        { key: 'credit', value: Number(reportData.credit), svg: { fill: reportColors.credit } },
    ].filter(item => item.value > 0);

    const Labels = ({ slices }) => {
        return slices.map((slice, index) => {
            const { pieCentroid, data } = slice;
            if (data.value === 0 || grossTotal === 0) return null;
            const percentage = (data.value / grossTotal) * 100;
            if (percentage < 5) return null;
            return (
                <SvgText
                    key={index}
                    x={pieCentroid[0]}
                    y={pieCentroid[1]}
                    fill={'white'}
                    textAnchor={'middle'}
                    alignmentBaseline={'middle'}
                    fontSize={14}
                    fontWeight={'bold'}
                >
                    {`${percentage.toFixed(0)}%`}
                </SvgText>
            );
        });
    };

    const chartSize = SCREEN_WIDTH * 0.6; // Responsive Chart Size (60% of width)

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
            
            {/* --- HEADER CARD --- */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.cardBg, shadowColor: isDark ? '#000' : '#888' }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10, padding: 4}}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.headerIconContainer, { backgroundColor: isDark ? '#333' : '#E0F2F1' }]}>
                        <MaterialCommunityIcons name="chart-pie" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.headerTitle, { color: COLORS.textMain }]}>Financial Reports</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textSub }]}>Summary & Analytics</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.filterContainer, { backgroundColor: COLORS.cardBg }]}>
                    <View style={[styles.segmentControl, { backgroundColor: COLORS.segmentBg }]}>
                        {['Daily', 'Monthly', 'Overall'].map(p => (
                            <TouchableOpacity key={p} style={[styles.segmentButton, activePeriod === p.toLowerCase() && { backgroundColor: COLORS.primary }]} onPress={() => handlePeriodChange(p.toLowerCase())}>
                                <Text style={[styles.segmentText, { color: activePeriod === p.toLowerCase() ? '#FFF' : COLORS.textMain }]}>{p}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.dateRangeContainer}>
                        <TouchableOpacity style={[styles.dateButton, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]} onPress={() => showDatePicker('start')}>
                            <MaterialIcons name="calendar-today" size={16} color={COLORS.textSub} />
                            <Text style={[styles.dateText, { color: COLORS.textMain }]}>{dateRange.start ? dateRange.start.split('-').reverse().join('/') : 'From Date'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.dateButton, { backgroundColor: COLORS.inputBg, borderColor: COLORS.border }]} onPress={() => showDatePicker('end')}>
                            <MaterialIcons name="calendar-today" size={16} color={COLORS.textSub} />
                            <Text style={[styles.dateText, { color: COLORS.textMain }]}>{dateRange.end ? dateRange.end.split('-').reverse().join('/') : 'To Date'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {isLoading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1, marginTop: 50 }} /> : (
                    <>
                        <View style={[styles.reportCard, { backgroundColor: COLORS.cardBg }]}>
                            <View style={styles.reportHeader}>
                                <Text style={[styles.schoolName, { color: COLORS.textMain }]}>Vivekananda Public School</Text>
                                <Text style={[styles.managedBy, { color: COLORS.textSub }]}>Managed by Vivekananda Education Center</Text>
                            </View>

                            <Text style={[styles.reportDateDisplay, { color: COLORS.textSub }]}>{displayDate}</Text>

                            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9, result: 'data-uri' }} style={{ backgroundColor: COLORS.cardBg }}>
                                <View style={styles.chartContainer}>
                                    {grossTotal > 0 && pieData.length > 0 ? (
                                        <PieChart
                                            style={{ height: chartSize, width: chartSize }}
                                            data={pieData}
                                            innerRadius={'35%'}
                                            padAngle={0.02}
                                        >
                                            <Labels />
                                        </PieChart>
                                    ) : (
                                        <Text style={[styles.noDataText, { color: COLORS.textSub }]}>No data available for this period.</Text>
                                    )}
                                </View>
                            </ViewShot>

                            <View style={[styles.legendContainer, { borderTopColor: COLORS.border }]}>
                                {Object.keys(reportColors).map(key => {
                                    const isDebit = key === 'debit';
                                    const isIncome = key === 'credit';
                                    const hasValue = Number(reportData[key]) > 0;
                                    return (
                                        <View key={key} style={styles.legendItem}>
                                            <View style={styles.legendLabelContainer}>
                                                <View style={[styles.legendColor, { backgroundColor: reportColors[key] }]} />
                                                <Text style={[styles.legendLabel, { color: COLORS.textSub }]}>{key.charAt(0).toUpperCase() + key.slice(1)}:</Text>
                                            </View>
                                            <View style={styles.legendAmountContainer}>
                                                {isDebit && hasValue && <Text style={[styles.debitSymbol, { color: COLORS.danger }]}>- </Text>}
                                                {isIncome && hasValue && <Text style={[styles.creditSymbol, { color: COLORS.success }]}>+ </Text>}
                                                <Text style={[styles.legendAmount, { color: COLORS.textMain }]}>₹{formatCurrency(reportData[key])}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={[styles.totalRow, { borderTopColor: COLORS.border }]}>
                                <Text style={[styles.totalLabel, { color: COLORS.textMain }]}>Total Amount</Text>
                                <Text style={[styles.totalAmount, { color: COLORS.textMain }]}>₹{formatCurrency(netTotal)}</Text>
                            </View>
                        </View>
                        
                        <TouchableOpacity style={[styles.downloadButton, { backgroundColor: COLORS.blue }]} onPress={downloadReport}>
                            <MaterialIcons name="download" size={20} color="#FFF" />
                            <Text style={styles.downloadButtonText}>Download Report</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            <DateTimePickerModal isVisible={isDatePickerVisible} mode="date" onConfirm={handleConfirmDate} onCancel={hideDatePicker} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // --- HEADER CARD STYLES ---
    headerCard: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        width: '95%', 
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        shadowOpacity: 0.1, 
        shadowRadius: 4, 
        shadowOffset: { width: 0, height: 2 },
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: {
        borderRadius: 30,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTextContainer: { justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerSubtitle: { fontSize: 13 },

    scrollContent: { padding: 15, paddingBottom: 50 },
    
    // Filters
    filterContainer: { borderRadius: 12, padding: 15, elevation: 2, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    segmentControl: { flexDirection: 'row', borderRadius: 8, marginBottom: 12 },
    segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 7 },
    segmentText: { textAlign: 'center', fontWeight: '600', fontSize: 13 },
    
    dateRangeContainer: { flexDirection: 'row', alignItems: 'center' },
    dateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginRight: 10, borderWidth: 1 },
    dateText: { marginLeft: 8, fontSize: 12, fontWeight: '500' },
    
    // Report Card
    reportCard: { borderRadius: 12, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    reportHeader: { alignItems: 'center' },
    schoolName: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
    managedBy: { fontSize: 12, marginTop: 2 },
    reportDateDisplay: { textAlign: 'center', fontSize: 14, fontWeight: '500', marginTop: 10 },
    
    chartContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
    noDataText: { fontSize: 16, textAlign: 'center', marginVertical: 20 },
    
    legendContainer: { marginTop: 10, paddingHorizontal: 5, borderTopWidth: 1, paddingTop: 15 },
    legendItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    legendLabelContainer: { flexDirection: 'row', alignItems: 'center' },
    legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    legendLabel: { fontSize: 15 },
    
    legendAmountContainer: { flexDirection: 'row', alignItems: 'center' },
    legendAmount: { fontSize: 15, fontWeight: '600' },
    debitSymbol: { fontSize: 15, fontWeight: 'bold' },
    creditSymbol: { fontSize: 15, fontWeight: 'bold' },
    
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 15, borderTopWidth: 1, paddingHorizontal: 5 },
    totalLabel: { fontSize: 17, fontWeight: 'bold' },
    totalAmount: { fontSize: 17, fontWeight: 'bold' },
    
    downloadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 8, marginTop: 20, marginBottom: 10 },
    downloadButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8, fontSize: 15 },
});

export default ReportsScreen;