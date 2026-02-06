///! GDS-II binary format parser.
///!
///! GDS-II (Graphic Data System II) is the industry-standard binary format
///! used by semiconductor fabs. This module reads GDS-II streams and converts
///! them into OpenSilicon's internal layout database representation.
///!
///! ## GDS-II Record Structure
///! Each record: [2-byte length][2-byte record type][payload]
///! Record types define the hierarchy: BGNLIB → BGNSTR → BOUNDARY/PATH/SREF → ENDSTR → ENDLIB

use std::io::{self, Read, Seek, SeekFrom};
use thiserror::Error;

use opensilicon_core::geometry::{Point, Polygon, Rect, Path as LayoutPath, Via, GeomPrimitive};
use opensilicon_core::cell::{Cell, CellInstance, Transform};
use opensilicon_core::database::LayoutDatabase;

// ── GDS-II Record Types ──────────────────────────────────────────────

#[allow(dead_code)]
mod record_type {
    pub const HEADER: u16     = 0x0002;
    pub const BGNLIB: u16     = 0x0102;
    pub const LIBNAME: u16    = 0x0206;
    pub const UNITS: u16      = 0x0305;
    pub const ENDLIB: u16     = 0x0400;
    pub const BGNSTR: u16     = 0x0502;
    pub const STRNAME: u16    = 0x0606;
    pub const ENDSTR: u16     = 0x0700;
    pub const BOUNDARY: u16   = 0x0800;
    pub const PATH: u16       = 0x0900;
    pub const SREF: u16       = 0x0A00;
    pub const AREF: u16       = 0x0B00;
    pub const TEXT: u16       = 0x0C00;
    pub const LAYER: u16      = 0x0D02;
    pub const DATATYPE: u16   = 0x0E02;
    pub const WIDTH: u16      = 0x0F03;
    pub const XY: u16         = 0x1003;
    pub const ENDEL: u16      = 0x1100;
    pub const SNAME: u16      = 0x1206;
    pub const COLROW: u16     = 0x1302;
    pub const NODE: u16       = 0x1500;
    pub const TEXTTYPE: u16   = 0x1602;
    pub const PRESENTATION: u16 = 0x1701;
    pub const STRING: u16     = 0x1906;
    pub const STRANS: u16     = 0x1A01;
    pub const MAG: u16        = 0x1B05;
    pub const ANGLE: u16      = 0x1C05;
    pub const PATHTYPE: u16   = 0x2102;
    pub const BOX: u16        = 0x2D00;
    pub const BOXTYPE: u16    = 0x2E02;
    pub const PROPATTR: u16   = 0x2B02;
    pub const PROPVALUE: u16  = 0x2C06;
}

// ── Data Type Tags ────────────────────────────────────────────────────

#[allow(dead_code)]
mod data_type {
    pub const NO_DATA: u8    = 0x00;
    pub const BIT_ARRAY: u8  = 0x01;
    pub const INT16: u8      = 0x02;
    pub const INT32: u8      = 0x03;
    pub const REAL4: u8      = 0x04;
    pub const REAL8: u8      = 0x05;
    pub const ASCII: u8      = 0x06;
}

// ── Errors ────────────────────────────────────────────────────────────

#[derive(Error, Debug)]
pub enum GdsError {
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    #[error("Invalid GDS-II record at offset {offset}: {message}")]
    InvalidRecord { offset: u64, message: String },

    #[error("Unexpected record type 0x{record_type:04X}, expected 0x{expected:04X}")]
    UnexpectedRecord { record_type: u16, expected: u16 },

    #[error("Unsupported GDS-II version: {0}")]
    UnsupportedVersion(u16),

    #[error("Invalid coordinate data")]
    InvalidCoordinates,

    #[error("Cell '{0}' referenced but not defined")]
    UndefinedCell(String),
}

// ── GDS-II Record ─────────────────────────────────────────────────────

#[derive(Debug)]
struct GdsRecord {
    record_type: u16,
    data: Vec<u8>,
}

impl GdsRecord {
    /// Get the record type (upper byte) without the data type tag.
    fn kind(&self) -> u8 {
        (self.record_type >> 8) as u8
    }

    /// Get the data type tag (lower byte).
    fn data_type_tag(&self) -> u8 {
        (self.record_type & 0xFF) as u8
    }

    /// Parse payload as 16-bit integers.
    fn as_i16_vec(&self) -> Vec<i16> {
        self.data
            .chunks_exact(2)
            .map(|c| i16::from_be_bytes([c[0], c[1]]))
            .collect()
    }

    /// Parse payload as 32-bit integers.
    fn as_i32_vec(&self) -> Vec<i32> {
        self.data
            .chunks_exact(4)
            .map(|c| i32::from_be_bytes([c[0], c[1], c[2], c[3]]))
            .collect()
    }

    /// Parse payload as ASCII string.
    fn as_string(&self) -> String {
        let s: String = self.data.iter().map(|&b| b as char).collect();
        s.trim_end_matches('\0').to_string()
    }

    /// Parse payload as GDS-II 8-byte real (excess-64 floating point).
    fn as_f64_vec(&self) -> Vec<f64> {
        self.data
            .chunks_exact(8)
            .map(|c| gds_real8_to_f64(c.try_into().unwrap()))
            .collect()
    }
}

/// Convert GDS-II excess-64 real format to IEEE 754 f64.
fn gds_real8_to_f64(bytes: &[u8; 8]) -> f64 {
    if bytes.iter().all(|&b| b == 0) {
        return 0.0;
    }

    let sign = if bytes[0] & 0x80 != 0 { -1.0 } else { 1.0 };
    let exponent = (bytes[0] & 0x7F) as i32 - 64;

    let mut mantissa: u64 = 0;
    for &b in &bytes[1..] {
        mantissa = (mantissa << 8) | (b as u64);
    }

    let mantissa_f = mantissa as f64 / (1u64 << 56) as f64;
    sign * mantissa_f * 16.0_f64.powi(exponent)
}

/// Convert IEEE 754 f64 to GDS-II excess-64 real format.
fn f64_to_gds_real8(value: f64) -> [u8; 8] {
    if value == 0.0 {
        return [0u8; 8];
    }

    let sign_bit: u8 = if value < 0.0 { 0x80 } else { 0x00 };
    let mut val = value.abs();

    // Find exponent such that 1/16 <= mantissa < 1
    let mut exponent: i32 = 1;
    while val >= 1.0 && exponent < 127 {
        val /= 16.0;
        exponent += 1;
    }
    while val < 1.0 / 16.0 && exponent > -64 {
        val *= 16.0;
        exponent -= 1;
    }

    let mantissa = (val * (1u64 << 56) as f64) as u64;
    let exp_byte = sign_bit | ((exponent + 64) as u8 & 0x7F);

    let mut result = [0u8; 8];
    result[0] = exp_byte;
    result[1] = ((mantissa >> 48) & 0xFF) as u8;
    result[2] = ((mantissa >> 40) & 0xFF) as u8;
    result[3] = ((mantissa >> 32) & 0xFF) as u8;
    result[4] = ((mantissa >> 24) & 0xFF) as u8;
    result[5] = ((mantissa >> 16) & 0xFF) as u8;
    result[6] = ((mantissa >> 8) & 0xFF) as u8;
    result[7] = (mantissa & 0xFF) as u8;
    result
}

// ── GDS-II Reader ─────────────────────────────────────────────────────

pub struct GdsReader<R: Read + Seek> {
    reader: R,
    db_unit_in_um: f64,
}

impl<R: Read + Seek> GdsReader<R> {
    pub fn new(reader: R) -> Self {
        Self {
            reader,
            db_unit_in_um: 0.001, // Default: 1nm database unit
        }
    }

    /// Read the entire GDS-II stream into a LayoutDatabase.
    pub fn read(&mut self) -> Result<LayoutDatabase, GdsError> {
        let mut db = LayoutDatabase::new("imported");

        self.read_header()?;
        self.read_lib(&mut db)?;

        Ok(db)
    }

    fn read_record(&mut self) -> Result<Option<GdsRecord>, GdsError> {
        let mut len_buf = [0u8; 2];
        match self.reader.read_exact(&mut len_buf) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
            Err(e) => return Err(GdsError::Io(e)),
        }

        let total_len = u16::from_be_bytes(len_buf) as usize;
        if total_len < 4 {
            let offset = self.reader.seek(SeekFrom::Current(0)).unwrap_or(0);
            return Err(GdsError::InvalidRecord {
                offset,
                message: format!("Record length {} is too small", total_len),
            });
        }

        let mut type_buf = [0u8; 2];
        self.reader.read_exact(&mut type_buf)?;
        let record_type = u16::from_be_bytes(type_buf);

        let data_len = total_len - 4;
        let mut data = vec![0u8; data_len];
        if data_len > 0 {
            self.reader.read_exact(&mut data)?;
        }

        Ok(Some(GdsRecord { record_type, data }))
    }

    fn read_header(&mut self) -> Result<(), GdsError> {
        let rec = self.read_record()?.ok_or(GdsError::InvalidRecord {
            offset: 0,
            message: "Empty file".into(),
        })?;

        if rec.record_type != record_type::HEADER {
            return Err(GdsError::UnexpectedRecord {
                record_type: rec.record_type,
                expected: record_type::HEADER,
            });
        }

        let version = rec.as_i16_vec();
        if !version.is_empty() {
            log::info!("GDS-II version: {}", version[0]);
        }

        Ok(())
    }

    fn read_lib(&mut self, db: &mut LayoutDatabase) -> Result<(), GdsError> {
        loop {
            let rec = match self.read_record()? {
                Some(r) => r,
                None => break,
            };

            match rec.record_type {
                record_type::BGNLIB => {
                    // Begin library — timestamp data, skip
                }
                record_type::LIBNAME => {
                    db.name = rec.as_string();
                    log::info!("Library name: {}", db.name);
                }
                record_type::UNITS => {
                    let units = rec.as_f64_vec();
                    if units.len() >= 2 {
                        self.db_unit_in_um = units[0] * 1e6; // Convert meters to μm
                        log::info!(
                            "Database unit: {} μm, user unit: {} m",
                            self.db_unit_in_um,
                            units[1]
                        );
                    }
                }
                record_type::BGNSTR => {
                    self.read_structure(db)?;
                }
                record_type::ENDLIB => {
                    log::info!("End of library. {} cells read.", db.cell_count());
                    break;
                }
                _ => {
                    // Skip unknown records
                }
            }
        }

        Ok(())
    }

    fn read_structure(&mut self, db: &mut LayoutDatabase) -> Result<(), GdsError> {
        let mut cell = Cell::new("unnamed");

        loop {
            let rec = match self.read_record()? {
                Some(r) => r,
                None => break,
            };

            match rec.record_type {
                record_type::STRNAME => {
                    cell.name = rec.as_string();
                    log::info!("Reading cell: {}", cell.name);
                }
                record_type::BOUNDARY => {
                    if let Some(geom) = self.read_boundary()? {
                        cell.add_geometry(geom);
                    }
                }
                record_type::PATH => {
                    if let Some(geom) = self.read_path()? {
                        cell.add_geometry(geom);
                    }
                }
                record_type::SREF => {
                    if let Some(inst) = self.read_sref()? {
                        cell.add_instance(inst);
                    }
                }
                record_type::BOX => {
                    if let Some(geom) = self.read_box()? {
                        cell.add_geometry(geom);
                    }
                }
                record_type::TEXT | record_type::NODE | record_type::AREF => {
                    // Skip to ENDEL
                    self.skip_to_endel()?;
                }
                record_type::ENDSTR => {
                    break;
                }
                _ => {}
            }
        }

        db.add_cell(cell);
        Ok(())
    }

    fn read_boundary(&mut self) -> Result<Option<GeomPrimitive>, GdsError> {
        let mut layer: u32 = 0;
        let mut _datatype: u16 = 0;
        let mut points: Vec<Point> = Vec::new();

        loop {
            let rec = match self.read_record()? {
                Some(r) => r,
                None => break,
            };

            match rec.record_type {
                record_type::LAYER => {
                    let vals = rec.as_i16_vec();
                    if !vals.is_empty() {
                        layer = vals[0] as u32;
                    }
                }
                record_type::DATATYPE => {
                    let vals = rec.as_i16_vec();
                    if !vals.is_empty() {
                        _datatype = vals[0] as u16;
                    }
                }
                record_type::XY => {
                    let coords = rec.as_i32_vec();
                    for pair in coords.chunks_exact(2) {
                        points.push(Point::new(
                            pair[0] as f64 * self.db_unit_in_um,
                            pair[1] as f64 * self.db_unit_in_um,
                        ));
                    }
                }
                record_type::ENDEL => break,
                _ => {}
            }
        }

        // GDS boundaries repeat the first point; remove it
        if points.len() > 1 && points.first() == points.last() {
            points.pop();
        }

        if points.is_empty() {
            return Ok(None);
        }

        // Check if this is an axis-aligned rectangle (4 vertices)
        if points.len() == 4 && is_axis_aligned_rect(&points) {
            let bbox = opensilicon_core::geometry::BBox::from_points(&points).unwrap();
            return Ok(Some(GeomPrimitive::Rect(Rect::new(
                layer,
                bbox.min.x,
                bbox.min.y,
                bbox.max.x,
                bbox.max.y,
            ))));
        }

        Ok(Some(GeomPrimitive::Polygon(Polygon::new(layer, points))))
    }

    fn read_path(&mut self) -> Result<Option<GeomPrimitive>, GdsError> {
        let mut layer: u32 = 0;
        let mut width: f64 = 0.0;
        let mut points: Vec<Point> = Vec::new();

        loop {
            let rec = match self.read_record()? {
                Some(r) => r,
                None => break,
            };

            match rec.record_type {
                record_type::LAYER => {
                    let vals = rec.as_i16_vec();
                    if !vals.is_empty() {
                        layer = vals[0] as u32;
                    }
                }
                record_type::DATATYPE => {}
                record_type::PATHTYPE => {}
                record_type::WIDTH => {
                    let vals = rec.as_i32_vec();
                    if !vals.is_empty() {
                        width = vals[0] as f64 * self.db_unit_in_um;
                    }
                }
                record_type::XY => {
                    let coords = rec.as_i32_vec();
                    for pair in coords.chunks_exact(2) {
                        points.push(Point::new(
                            pair[0] as f64 * self.db_unit_in_um,
                            pair[1] as f64 * self.db_unit_in_um,
                        ));
                    }
                }
                record_type::ENDEL => break,
                _ => {}
            }
        }

        if points.is_empty() {
            return Ok(None);
        }

        Ok(Some(GeomPrimitive::Path(LayoutPath::new(
            layer, points, width,
        ))))
    }

    fn read_sref(&mut self) -> Result<Option<CellInstance>, GdsError> {
        let mut cell_name = String::new();
        let mut transform = Transform::default();
        let mut position = Point::new(0.0, 0.0);

        loop {
            let rec = match self.read_record()? {
                Some(r) => r,
                None => break,
            };

            match rec.record_type {
                record_type::SNAME => {
                    cell_name = rec.as_string();
                }
                record_type::STRANS => {
                    let vals = rec.as_i16_vec();
                    if !vals.is_empty() {
                        transform.mirror_x = (vals[0] & 0x8000u16 as i16) != 0;
                    }
                }
                record_type::MAG => {
                    let vals = rec.as_f64_vec();
                    if !vals.is_empty() {
                        transform.scale = vals[0];
                    }
                }
                record_type::ANGLE => {
                    let vals = rec.as_f64_vec();
                    if !vals.is_empty() {
                        transform.rotation = vals[0];
                    }
                }
                record_type::XY => {
                    let coords = rec.as_i32_vec();
                    if coords.len() >= 2 {
                        position = Point::new(
                            coords[0] as f64 * self.db_unit_in_um,
                            coords[1] as f64 * self.db_unit_in_um,
                        );
                    }
                }
                record_type::ENDEL => break,
                _ => {}
            }
        }

        if cell_name.is_empty() {
            return Ok(None);
        }

        transform.offset = position;

        // We use a nil UUID here; it will be resolved when the full library is loaded
        Ok(Some(CellInstance::new(
            uuid::Uuid::nil(),
            &cell_name,
            transform,
        )))
    }

    fn read_box(&mut self) -> Result<Option<GeomPrimitive>, GdsError> {
        // BOX is similar to BOUNDARY but with BOXTYPE instead of DATATYPE
        let mut layer: u32 = 0;
        let mut points: Vec<Point> = Vec::new();

        loop {
            let rec = match self.read_record()? {
                Some(r) => r,
                None => break,
            };

            match rec.record_type {
                record_type::LAYER => {
                    let vals = rec.as_i16_vec();
                    if !vals.is_empty() {
                        layer = vals[0] as u32;
                    }
                }
                record_type::BOXTYPE => {}
                record_type::XY => {
                    let coords = rec.as_i32_vec();
                    for pair in coords.chunks_exact(2) {
                        points.push(Point::new(
                            pair[0] as f64 * self.db_unit_in_um,
                            pair[1] as f64 * self.db_unit_in_um,
                        ));
                    }
                }
                record_type::ENDEL => break,
                _ => {}
            }
        }

        if points.len() > 1 && points.first() == points.last() {
            points.pop();
        }

        if points.is_empty() {
            return Ok(None);
        }

        let bbox = opensilicon_core::geometry::BBox::from_points(&points).unwrap();
        Ok(Some(GeomPrimitive::Rect(Rect::new(
            layer,
            bbox.min.x,
            bbox.min.y,
            bbox.max.x,
            bbox.max.y,
        ))))
    }

    fn skip_to_endel(&mut self) -> Result<(), GdsError> {
        loop {
            let rec = match self.read_record()? {
                Some(r) => r,
                None => break,
            };
            if rec.record_type == record_type::ENDEL {
                break;
            }
        }
        Ok(())
    }
}

/// Check if 4 points form an axis-aligned rectangle.
fn is_axis_aligned_rect(points: &[Point]) -> bool {
    if points.len() != 4 {
        return false;
    }
    let xs: Vec<f64> = points.iter().map(|p| p.x).collect();
    let ys: Vec<f64> = points.iter().map(|p| p.y).collect();

    let unique_x: std::collections::HashSet<u64> = xs.iter().map(|x| x.to_bits()).collect();
    let unique_y: std::collections::HashSet<u64> = ys.iter().map(|y| y.to_bits()).collect();

    unique_x.len() == 2 && unique_y.len() == 2
}

// ── GDS-II Writer ─────────────────────────────────────────────────────

pub struct GdsWriter<W: io::Write> {
    writer: W,
    db_unit_in_um: f64,
}

impl<W: io::Write> GdsWriter<W> {
    pub fn new(writer: W) -> Self {
        Self {
            writer,
            db_unit_in_um: 0.001,
        }
    }

    /// Write a LayoutDatabase as a GDS-II stream.
    pub fn write(&mut self, db: &LayoutDatabase) -> Result<(), GdsError> {
        self.write_header()?;
        self.write_bgnlib()?;
        self.write_libname(&db.name)?;
        self.write_units()?;

        for cell in db.all_cells() {
            self.write_cell(cell)?;
        }

        self.write_endlib()?;
        Ok(())
    }

    fn write_record(&mut self, record_type: u16, data: &[u8]) -> Result<(), GdsError> {
        let total_len = (data.len() + 4) as u16;
        self.writer.write_all(&total_len.to_be_bytes())?;
        self.writer.write_all(&record_type.to_be_bytes())?;
        if !data.is_empty() {
            self.writer.write_all(data)?;
        }
        Ok(())
    }

    fn write_i16_record(&mut self, record_type: u16, values: &[i16]) -> Result<(), GdsError> {
        let data: Vec<u8> = values.iter().flat_map(|v| v.to_be_bytes()).collect();
        self.write_record(record_type, &data)
    }

    fn write_i32_record(&mut self, record_type: u16, values: &[i32]) -> Result<(), GdsError> {
        let data: Vec<u8> = values.iter().flat_map(|v| v.to_be_bytes()).collect();
        self.write_record(record_type, &data)
    }

    fn write_string_record(&mut self, record_type: u16, s: &str) -> Result<(), GdsError> {
        let mut data: Vec<u8> = s.bytes().collect();
        // GDS strings must be even length
        if data.len() % 2 != 0 {
            data.push(0);
        }
        self.write_record(record_type, &data)
    }

    fn write_real8_record(&mut self, record_type: u16, values: &[f64]) -> Result<(), GdsError> {
        let data: Vec<u8> = values
            .iter()
            .flat_map(|v| f64_to_gds_real8(*v))
            .collect();
        self.write_record(record_type, &data)
    }

    fn write_header(&mut self) -> Result<(), GdsError> {
        self.write_i16_record(record_type::HEADER, &[600]) // GDS version 6
    }

    fn write_bgnlib(&mut self) -> Result<(), GdsError> {
        // Timestamp: 12 i16 values (mod/access date)
        let timestamp = [2026i16, 2, 6, 0, 0, 0, 2026, 2, 6, 0, 0, 0];
        self.write_i16_record(record_type::BGNLIB, &timestamp)
    }

    fn write_libname(&mut self, name: &str) -> Result<(), GdsError> {
        self.write_string_record(record_type::LIBNAME, name)
    }

    fn write_units(&mut self) -> Result<(), GdsError> {
        // db_unit_in_user_units, db_unit_in_meters
        let db_in_m = self.db_unit_in_um * 1e-6;
        self.write_real8_record(record_type::UNITS, &[self.db_unit_in_um * 1e-3, db_in_m])
    }

    fn write_cell(&mut self, cell: &Cell) -> Result<(), GdsError> {
        // BGNSTR
        let timestamp = [2026i16, 2, 6, 0, 0, 0, 2026, 2, 6, 0, 0, 0];
        self.write_i16_record(record_type::BGNSTR, &timestamp)?;

        // STRNAME
        self.write_string_record(record_type::STRNAME, &cell.name)?;

        // Write all geometries
        for geom in &cell.geometries {
            match geom {
                GeomPrimitive::Rect(rect) => self.write_rect(rect)?,
                GeomPrimitive::Polygon(poly) => self.write_polygon(poly)?,
                GeomPrimitive::Path(path) => self.write_path(path)?,
                GeomPrimitive::Via(via) => self.write_via(via)?,
            }
        }

        // Write instances
        for inst in &cell.instances {
            self.write_sref(inst)?;
        }

        // ENDSTR
        self.write_record(record_type::ENDSTR, &[])?;
        Ok(())
    }

    fn write_rect(&mut self, rect: &Rect) -> Result<(), GdsError> {
        let scale = 1.0 / self.db_unit_in_um;
        let x1 = (rect.lower_left.x * scale) as i32;
        let y1 = (rect.lower_left.y * scale) as i32;
        let x2 = (rect.upper_right.x * scale) as i32;
        let y2 = (rect.upper_right.y * scale) as i32;

        self.write_record(record_type::BOUNDARY, &[])?;
        self.write_i16_record(record_type::LAYER, &[rect.layer_id as i16])?;
        self.write_i16_record(record_type::DATATYPE, &[0])?;
        // 5 points: closed rectangle
        self.write_i32_record(
            record_type::XY,
            &[x1, y1, x2, y1, x2, y2, x1, y2, x1, y1],
        )?;
        self.write_record(record_type::ENDEL, &[])?;
        Ok(())
    }

    fn write_polygon(&mut self, poly: &Polygon) -> Result<(), GdsError> {
        let scale = 1.0 / self.db_unit_in_um;

        self.write_record(record_type::BOUNDARY, &[])?;
        self.write_i16_record(record_type::LAYER, &[poly.layer_id as i16])?;
        self.write_i16_record(record_type::DATATYPE, &[0])?;

        let mut coords: Vec<i32> = poly
            .vertices
            .iter()
            .flat_map(|p| vec![(p.x * scale) as i32, (p.y * scale) as i32])
            .collect();
        // Close the polygon
        if let Some(first) = poly.vertices.first() {
            coords.push((first.x * scale) as i32);
            coords.push((first.y * scale) as i32);
        }

        self.write_i32_record(record_type::XY, &coords)?;
        self.write_record(record_type::ENDEL, &[])?;
        Ok(())
    }

    fn write_path(&mut self, path: &LayoutPath) -> Result<(), GdsError> {
        let scale = 1.0 / self.db_unit_in_um;

        self.write_record(record_type::PATH, &[])?;
        self.write_i16_record(record_type::LAYER, &[path.layer_id as i16])?;
        self.write_i16_record(record_type::DATATYPE, &[0])?;
        self.write_i32_record(record_type::WIDTH, &[(path.width * scale) as i32])?;

        let coords: Vec<i32> = path
            .points
            .iter()
            .flat_map(|p| vec![(p.x * scale) as i32, (p.y * scale) as i32])
            .collect();

        self.write_i32_record(record_type::XY, &coords)?;
        self.write_record(record_type::ENDEL, &[])?;
        Ok(())
    }

    fn write_via(&mut self, via: &Via) -> Result<(), GdsError> {
        // Write via as a rectangle on the cut layer
        let half_w = via.width / 2.0;
        let half_h = via.height / 2.0;
        let rect = Rect::new(
            via.cut_layer,
            via.position.x - half_w,
            via.position.y - half_h,
            via.position.x + half_w,
            via.position.y + half_h,
        );
        self.write_rect(&rect)
    }

    fn write_sref(&mut self, inst: &CellInstance) -> Result<(), GdsError> {
        let scale = 1.0 / self.db_unit_in_um;

        self.write_record(record_type::SREF, &[])?;
        self.write_string_record(record_type::SNAME, &inst.instance_name)?;

        // STRANS if mirrored
        if inst.transform.mirror_x {
            self.write_i16_record(record_type::STRANS, &[i16::MIN])?; // 0x8000
        } else if inst.transform.rotation != 0.0 || inst.transform.scale != 1.0 {
            self.write_i16_record(record_type::STRANS, &[0])?;
        }

        if inst.transform.scale != 1.0 {
            self.write_real8_record(record_type::MAG, &[inst.transform.scale])?;
        }

        if inst.transform.rotation != 0.0 {
            self.write_real8_record(record_type::ANGLE, &[inst.transform.rotation])?;
        }

        let x = (inst.transform.offset.x * scale) as i32;
        let y = (inst.transform.offset.y * scale) as i32;
        self.write_i32_record(record_type::XY, &[x, y])?;

        self.write_record(record_type::ENDEL, &[])?;
        Ok(())
    }

    fn write_endlib(&mut self) -> Result<(), GdsError> {
        self.write_record(record_type::ENDLIB, &[])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_gds_real8_roundtrip() {
        let values = [0.0, 1.0, -1.0, 0.001, 1e-9, 3.14159, 1000.0];
        for &v in &values {
            let bytes = f64_to_gds_real8(v);
            let result = gds_real8_to_f64(&bytes);
            assert!(
                (result - v).abs() < v.abs() * 1e-10 + 1e-15,
                "Roundtrip failed for {}: got {}",
                v,
                result
            );
        }
    }

    #[test]
    fn test_write_and_read_roundtrip() {
        let mut db = LayoutDatabase::new("test_lib");
        let mut cell = Cell::new("test_cell");
        cell.add_geometry(GeomPrimitive::Rect(Rect::new(0, 0.0, 0.0, 1.0, 0.5)));
        cell.add_geometry(GeomPrimitive::Rect(Rect::new(1, 0.5, 0.25, 2.0, 0.75)));
        db.add_cell(cell);

        // Write
        let mut buffer: Vec<u8> = Vec::new();
        let mut writer = GdsWriter::new(&mut buffer);
        writer.write(&db).unwrap();

        // Read back
        let cursor = Cursor::new(buffer);
        let mut reader = GdsReader::new(cursor);
        let read_db = reader.read().unwrap();

        assert_eq!(read_db.cell_count(), 1);
        let read_cell = read_db.find_cell_by_name("test_cell").unwrap();
        assert_eq!(read_cell.geometry_count(), 2);
    }
}
